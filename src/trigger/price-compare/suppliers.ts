import type { AiConfig } from "./config.js";
import { columnLetter, type SheetClient, type TableSpec } from "./sheet.js";
import { MockSource } from "./sources/mock.js";
import { SCRAPERS } from "./sources/scrapers/index.js";
import { WebResearchSource } from "./sources/web-research.js";
import type { Source, SourceError, SupplierConfig, SupplierType } from "./types.js";

export const SUPPLIER_TYPES: SupplierType[] = ["mock", "scraper", "web-research"];

export const SUPPLIERS_TABLE: TableSpec = {
  columns: [
    { header: "Supplier", width: 230 },
    { header: "Type", width: 120, align: "CENTER" },
    { header: "Scraper", width: 130 },
    { header: "Website", width: 230 },
    { header: "Currency", width: 80, align: "CENTER" },
    { header: "Enabled", width: 80, align: "CENTER" },
    { header: "Mock", width: 70, align: "CENTER" },
    { header: "Settings", width: 300 },
    { header: "Notes", width: 360 },
  ],
  frozenColumns: 1,
  pills: [
    { column: "Enabled", condition: "TEXT_EQ", value: "Yes", bg: "#D9EAD3", fg: "#274E13" },
    { column: "Enabled", condition: "TEXT_EQ", value: "No", bg: "#EFEFEF", fg: "#666666" },
    { column: "Mock", condition: "TEXT_EQ", value: "Yes", bg: "#FFF2CC", fg: "#7F6000" },
  ],
  dropdowns: [
    { column: "Type", options: SUPPLIER_TYPES },
    { column: "Enabled", options: ["Yes", "No"] },
    { column: "Mock", options: ["Yes", "No"] },
  ],
};

/** Starter rows written by the setup task. Edit suppliers in the sheet, not here. */
export const DEFAULT_SUPPLIERS: string[][] = [
  ["Harbour Marine Stores (mock)", "mock", "", "https://harbour-marine.example", "USD", "Yes", "Yes", "categories=stores,provisions", "Pretend chandler: deck/engine stores and provisions."],
  ["Oceanic Engine Spares (mock)", "mock", "", "https://oceanic-spares.example", "SGD", "Yes", "Yes", "categories=spares", "Pretend spares dealer pricing in SGD (tests currency conversion)."],
  ["Port Provisions Co. (mock)", "mock", "", "https://port-provisions.example", "USD", "Yes", "Yes", "categories=provisions,stores", "Pretend provisions supplier."],
  ["Flaky Supply Hub (mock)", "mock", "", "https://flaky-supply.example", "USD", "No", "Yes", "simulate=down", "Always fails. Enable it to test that one broken supplier doesn't stop a run."],
  ["Open web (Claude research)", "web-research", "", "", "USD", "No", "No", "maxSearches=4", "Claude searches the open web. Costs Claude credits per item (results reused for CACHE_TTL_HOURS). Needs ANTHROPIC_API_KEY."],
];

/** "key=value; key=value" → { key: value }. */
export function parseSettings(text: string): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const part of text.split(";")) {
    const at = part.indexOf("=");
    if (at > 0) settings[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return settings;
}

const yes = (value: string | undefined) => ["yes", "y", "true", "1"].includes((value ?? "").trim().toLowerCase());

/** Turns Suppliers rows (without the header) into configs; rows without a name are skipped. */
export function parseSupplierRows(rows: string[][]): SupplierConfig[] {
  return rows
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) => ({
      name: r[0]!.trim(),
      type: (r[1] ?? "").trim().toLowerCase() as SupplierType,
      scraper: (r[2] ?? "").trim(),
      url: (r[3] ?? "").trim(),
      currency: ((r[4] ?? "").trim() || "USD").toUpperCase(),
      enabled: yes(r[5]),
      mock: yes(r[6]),
      settings: parseSettings(r[7] ?? ""),
    }));
}

export async function loadSuppliers(sheet: SheetClient, tab = "Suppliers"): Promise<SupplierConfig[]> {
  const rows = await sheet.getValues(tab, `A2:${columnLetter(SUPPLIERS_TABLE.columns.length - 1)}`);
  return parseSupplierRows(rows);
}

/**
 * One Source per enabled supplier. Rows that can't be used (unknown type or scraper, web research
 * without a Claude key) are reported as errors instead of stopping the run.
 */
export function buildSources(
  suppliers: SupplierConfig[],
  options: { ai: AiConfig | null; includeMock: boolean },
): { sources: Source[]; setupErrors: SourceError[] } {
  const sources: Source[] = [];
  const setupErrors: SourceError[] = [];
  const fail = (s: SupplierConfig, error: string) => setupErrors.push({ supplier: s.name, item: "(all)", error });

  for (const s of suppliers) {
    if (!s.enabled) continue;
    if (s.mock && !options.includeMock) continue;
    if (s.type === "mock") sources.push(new MockSource(s));
    else if (s.type === "scraper") {
      const make = SCRAPERS[s.scraper];
      if (make) sources.push(make(s));
      else fail(s, `No scraper named "${s.scraper}" (see sources/scrapers/index.ts)`);
    } else if (s.type === "web-research") {
      if (options.ai) sources.push(new WebResearchSource(s, options.ai));
      else fail(s, "Skipped: ANTHROPIC_API_KEY is not set");
    } else fail(s, `Unknown type "${s.type}" (use ${SUPPLIER_TYPES.join(", ")})`);
  }
  return { sources, setupErrors };
}
