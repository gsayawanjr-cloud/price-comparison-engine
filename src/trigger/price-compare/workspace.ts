import { aiConfig, sheetAccess, settings, type AiConfig } from "./config.js";
import { SheetCache } from "./cache.js";
import { columnLetter, SheetClient, type Cell, type TableSpec, type TabInfo } from "./sheet.js";
import { buildSources, loadSuppliers } from "./suppliers.js";
import { RUN_LOG_TABLE } from "./tables.js";
import type { ItemResult, Source, SourceError } from "./types.js";

export const TABS = {
  suppliers: "Suppliers",
  requisition: "Requisition",
  comparison: "Comparison",
  catalogue: "Catalogue",
  marketCheck: "Market Check",
  runLog: "Run Log",
};

/** Everything a run needs, checked up front so nothing half-runs. */
export async function openWorkspace() {
  const config = settings();
  const ai = aiConfig();
  const sheet = await SheetClient.connect(sheetAccess());
  const suppliers = await loadSuppliers(sheet, TABS.suppliers);
  const { sources, setupErrors } = buildSources(suppliers, { ai, includeMock: config.includeMock });
  if (sources.length === 0) {
    throw new Error(`No usable suppliers: enable at least one row in the ${TABS.suppliers} tab${setupErrors.length ? ` (${setupErrors.map((e) => `${e.supplier}: ${e.error}`).join("; ")})` : ""}`);
  }
  const cache = await SheetCache.load(sheet, config.cacheTtlHours);
  return { config, ai, sheet, sources, setupErrors, cache };
}

/** Replaces a tab's rows under the header, with the table layout applied. */
export async function writeTable(sheet: SheetClient, title: string, spec: TableSpec, rows: Cell[][]): Promise<void> {
  const tab = await sheet.ensureTab(title);
  await sheet.clearValues(title, `A2:${columnLetter(spec.columns.length - 1)}`);
  if (rows.length > 0) await sheet.putValues(title, "A2", rows);
  await sheet.applyLayout(tab, spec);
}

/**
 * Finds or creates the Run Log tab and keeps it hidden (unhide it from the sheet's tab menu to
 * read it). Hidden on every call, so a tab someone unhid goes back out of the way.
 */
export async function runLogTab(sheet: SheetClient): Promise<TabInfo> {
  const tab = await sheet.ensureTab(TABS.runLog, { hidden: true });
  await sheet.batchUpdate([{ updateSheetProperties: { properties: { sheetId: tab.sheetId, hidden: true }, fields: "hidden" } }]);
  return tab;
}

/** Adds one line to the (hidden) Run Log tab. */
export async function logRun(
  sheet: SheetClient,
  mode: string,
  results: Pick<ItemResult, "offers" | "errors">[],
  sources: Source[],
  setupErrors: SourceError[],
  ai: AiConfig | null,
): Promise<void> {
  const tab = await runLogTab(sheet);
  const problems = [...setupErrors, ...results.flatMap((r) => r.errors)];
  // Collapse repeats (one supplier down fails every item) into "supplier: error (×N)".
  const counts = new Map<string, number>();
  for (const p of problems) counts.set(`${p.supplier}: ${p.error}`, (counts.get(`${p.supplier}: ${p.error}`) ?? 0) + 1);
  await sheet.appendValues(TABS.runLog, [
    [
      new Date().toISOString().slice(0, 16).replace("T", " "),
      mode,
      results.length,
      results.reduce((n, r) => n + r.offers.length, 0),
      sources.map((s) => s.supplier.name).join(", "),
      [...counts].map(([text, n]) => (n > 1 ? `${text} (×${n})` : text)).join("\n"),
      ai ? ai.usage.calls : "off",
      ai ? `${ai.usage.inputTokens} / ${ai.usage.outputTokens}` : "",
    ],
  ]);
  await sheet.applyLayout(tab, RUN_LOG_TABLE);
}
