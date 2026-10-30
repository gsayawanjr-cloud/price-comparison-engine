import { logger, schedules } from "@trigger.dev/sdk";
import { isPaused } from "./config.js";
import { compareItems } from "./engine.js";
import { columnLetter } from "./sheet.js";
import { catalogueTable, marketCheckRows, marketCheckTable, parseCatalogue } from "./tables.js";
import { logRun, openWorkspace, TABS, writeTable } from "./workspace.js";

/**
 * Every Monday 06:00 Manila time: prices every Catalogue item at every enabled supplier and
 * writes where our price sits against the market to the Market Check tab. Use "Test" in the
 * dashboard to run it now.
 */
export const weeklyMarketCheck = schedules.task({
  id: "weekly-market-check",
  cron: { pattern: "0 6 * * 1", timezone: "Asia/Manila" },
  maxDuration: 3600,
  run: async () => {
    if (isPaused()) {
      logger.info("Switched off (PRICE_PAUSED=true); nothing to do");
      return { skipped: true };
    }
    const { config, ai, sheet, sources, setupErrors, cache } = await openWorkspace();
    const spec = catalogueTable(config.fx.base);
    const items = parseCatalogue(await sheet.getRawValues(TABS.catalogue, `A2:${columnLetter(spec.columns.length - 1)}`));
    if (items.length === 0) throw new Error(`The ${TABS.catalogue} tab has no items`);

    logger.info("Checking catalogue against the market", { items: items.length, suppliers: sources.map((s) => s.supplier.name) });
    const checkedAt = new Date().toISOString();
    const results = await compareItems(items, { sources, ai, fx: config.fx, cache });
    await cache.flush();

    // compareItems keeps the input order, so results[i] belongs to items[i].
    const rows = marketCheckRows(
      results.map((r, i) => ({ ...r, item: items[i]! })),
      config.thresholdPct,
      config.fx.base,
      checkedAt,
    );
    await writeTable(sheet, TABS.marketCheck, marketCheckTable(config.fx.base), rows);
    await logRun(sheet, "Market check", results, sources, setupErrors, ai);

    const positions = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [String(r[9])]: (acc[String(r[9])] ?? 0) + 1 }), {});
    return { items: items.length, positions, claudeCalls: ai?.usage.calls ?? 0 };
  },
});
