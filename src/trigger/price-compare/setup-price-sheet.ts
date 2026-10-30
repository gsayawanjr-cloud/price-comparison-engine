import { logger, task } from "@trigger.dev/sdk";
import { sheetAccess, settings } from "./config.js";
import { SAMPLE_CATALOGUE, SAMPLE_REQUISITION } from "./samples.js";
import { SheetClient, type Cell, type TableSpec } from "./sheet.js";
import { DEFAULT_SUPPLIERS, SUPPLIERS_TABLE } from "./suppliers.js";
import { catalogueTable, comparisonTable, marketCheckTable, REQUISITION_TABLE, RUN_LOG_TABLE } from "./tables.js";
import { runLogTab, TABS } from "./workspace.js";

/**
 * Creates and formats every tab. Starter rows (mock suppliers, a sample requisition and catalogue)
 * go only into empty tabs, so running it again never overwrites your data. Safe to re-run any time,
 * e.g. to restore formatting.
 */
export const setupPriceSheet = task({
  id: "setup-price-sheet",
  maxDuration: 300,
  run: async () => {
    const { fx } = settings();
    const sheet = await SheetClient.connect(sheetAccess());
    const filled: string[] = [];

    const prepare = async (title: string, spec: TableSpec, starter: Cell[][] = []) => {
      const tab = await sheet.ensureTab(title);
      const existing = await sheet.getValues(title, "A2:A");
      if (starter.length > 0 && existing.every((r) => !r[0])) {
        await sheet.putValues(title, "A2", starter);
        filled.push(title);
      }
      await sheet.applyLayout(tab, spec);
    };

    await prepare(TABS.suppliers, SUPPLIERS_TABLE, DEFAULT_SUPPLIERS);
    await prepare(TABS.requisition, REQUISITION_TABLE, SAMPLE_REQUISITION);
    await prepare(TABS.comparison, comparisonTable(fx.base));
    await prepare(TABS.catalogue, catalogueTable(fx.base), SAMPLE_CATALOGUE);
    await prepare(TABS.marketCheck, marketCheckTable(fx.base));
    // Run Log stays hidden: run history for troubleshooting, not something to read every day.
    await sheet.applyLayout(await runLogTab(sheet), RUN_LOG_TABLE);

    logger.info("Price sheet ready", { startersWritten: filled });
    return { tabs: Object.values(TABS), startersWritten: filled };
  },
});
