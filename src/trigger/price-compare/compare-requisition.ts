import { logger, task } from "@trigger.dev/sdk";
import { compareItems } from "./engine.js";
import { columnLetter } from "./sheet.js";
import { comparisonRows, comparisonTable, parseRequisition, REQUISITION_TABLE } from "./tables.js";
import { logRun, openWorkspace, TABS, writeTable } from "./workspace.js";

/**
 * Prices every line in the Requisition tab at every enabled supplier and writes the ranked
 * offers to the Comparison tab (replacing the previous comparison). Run it from the dashboard.
 * Payload (optional): { "tab": "Requisition 2" } to read another tab laid out the same way.
 */
export const compareRequisition = task({
  id: "compare-requisition",
  maxDuration: 1800,
  run: async (payload: { tab?: string } = {}) => {
    const { config, ai, sheet, sources, setupErrors, cache } = await openWorkspace();
    const inputTab = payload.tab || TABS.requisition;
    const items = parseRequisition(await sheet.getRawValues(inputTab, `A2:${columnLetter(REQUISITION_TABLE.columns.length - 1)}`));
    if (items.length === 0) throw new Error(`The ${inputTab} tab has no items`);

    logger.info("Comparing requisition", { items: items.length, suppliers: sources.map((s) => s.supplier.name) });
    const results = await compareItems(items, { sources, ai, fx: config.fx, cache });
    await cache.flush();

    await writeTable(sheet, TABS.comparison, comparisonTable(config.fx.base), comparisonRows(results));
    await logRun(sheet, inputTab === TABS.requisition ? "Requisition" : `Requisition (${inputTab})`, results, sources, setupErrors, ai);

    return {
      items: items.length,
      itemsWithOffers: results.filter((r) => r.offers.length > 0).length,
      offers: results.reduce((n, r) => n + r.offers.length, 0),
      problems: setupErrors.length + results.reduce((n, r) => n + r.errors.length, 0),
      claudeCalls: ai?.usage.calls ?? 0,
    };
  },
});
