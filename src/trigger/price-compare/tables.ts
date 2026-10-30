import type { Cell, TableSpec } from "./sheet.js";
import type { Item, ItemResult, RankedOffer } from "./types.js";

// Widths are maximums: columns shrink to their content, and longer text wraps.
const MATCH_PILLS = [
  { value: "exact", bg: "#D9EAD3", fg: "#274E13" },
  { value: "likely", bg: "#CFE2F3", fg: "#1C4587" },
  { value: "weak", bg: "#FCE5CD", fg: "#B45F06" },
];

// ─── Inputs ─────────────────────────────────────────────────────────────────────────────────

export const REQUISITION_TABLE: TableSpec = {
  columns: [
    { header: "Line", width: 60, align: "CENTER" },
    { header: "IMPA / ISSA", width: 100, align: "CENTER" },
    { header: "Part No.", width: 140 },
    { header: "Maker", width: 130 },
    { header: "Description", width: 340 },
    { header: "Qty", width: 70, align: "RIGHT" },
    { header: "Unit", width: 70, align: "CENTER" },
  ],
  frozenColumns: 1,
};

export function catalogueTable(base: string): TableSpec {
  return {
    columns: [
      { header: "SKU", width: 130 },
      { header: "IMPA / ISSA", width: 100, align: "CENTER" },
      { header: "Part No.", width: 140 },
      { header: "Maker", width: 130 },
      { header: "Description", width: 320 },
      { header: "Unit", width: 70, align: "CENTER" },
      { header: `Our cost per unit (${base})`, width: 120, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: `Our price per unit (${base})`, width: 120, align: "RIGHT", numberFormat: "#,##0.00" },
    ],
    frozenColumns: 1,
  };
}

const text = (cell: Cell | undefined) => String(cell ?? "").trim();
const num = (cell: Cell | undefined): number | null => {
  if (typeof cell === "number") return cell;
  const value = Number(text(cell).replace(/,/g, ""));
  return text(cell) !== "" && Number.isFinite(value) ? value : null;
};
const hasItem = (r: Cell[], codeCols: number[]) => codeCols.some((i) => text(r[i]) !== "");

/** Requisition rows (raw values, no header) → items. Blank lines are skipped. */
export function parseRequisition(rows: Cell[][]): Item[] {
  return rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => hasItem(r, [1, 2, 4]))
    .map(({ r, i }) => ({
      ref: text(r[0]) || String(i + 1),
      impa: text(r[1]),
      partNumber: text(r[2]),
      maker: text(r[3]),
      description: text(r[4]),
      quantity: num(r[5]),
      unit: text(r[6]),
    }));
}

export type CatalogueItem = Item & { ourCost: number | null; ourPrice: number | null };

/** Catalogue rows (raw values, no header) → items with our cost and price. */
export function parseCatalogue(rows: Cell[][]): CatalogueItem[] {
  return rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => hasItem(r, [1, 2, 4]))
    .map(({ r, i }) => ({
      ref: text(r[0]) || `row ${i + 2}`,
      impa: text(r[1]),
      partNumber: text(r[2]),
      maker: text(r[3]),
      description: text(r[4]),
      quantity: null,
      unit: text(r[5]),
      ourCost: num(r[6]),
      ourPrice: num(r[7]),
    }));
}

// ─── Comparison (requisition mode) ──────────────────────────────────────────────────────────

export function comparisonTable(base: string): TableSpec {
  return {
    columns: [
      { header: "Line", width: 55, align: "CENTER" },
      { header: "Item", width: 260 },
      { header: "Qty", width: 60, align: "RIGHT" },
      { header: "Unit", width: 60, align: "CENTER" },
      { header: "Rank", width: 55, align: "CENTER" },
      { header: "Supplier", width: 210 },
      { header: "Match", width: 85, align: "CENTER" },
      { header: "Match note", width: 260 },
      { header: "Listing", width: 280 },
      { header: "Pack", width: 90, align: "CENTER" },
      { header: "Pack price", width: 95, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: "Currency", width: 75, align: "CENTER" },
      { header: `Unit price (${base})`, width: 105, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: `Total (${base})`, width: 105, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: "Availability", width: 100, align: "CENTER" },
      { header: "Link", width: 220, muted: true },
      { header: "Checked (UTC)", width: 125, align: "CENTER" },
      { header: "Problems", width: 300 },
    ],
    frozenColumns: 2,
    pills: [
      ...MATCH_PILLS.map((p) => ({ column: "Match", condition: "TEXT_EQ" as const, ...p })),
      { column: "Rank", condition: "NUMBER_EQ", value: "1", bg: "#D9EAD3", fg: "#274E13" },
    ],
  };
}

export function itemLabel(item: Item): string {
  return [item.impa && `IMPA ${item.impa}`, [item.maker, item.partNumber].filter(Boolean).join(" "), item.description].filter(Boolean).join(" · ");
}

function supplierLabel(o: RankedOffer): string {
  return o.mock && !/mock/i.test(o.supplier) ? `${o.supplier} [MOCK]` : o.supplier;
}

const round2 = (n: number | null) => (n === null ? "" : Math.round(n * 100) / 100);
const utc = (iso: string) => iso.slice(0, 16).replace("T", " ");

/**
 * One row per offer, best first within each item; an item with nothing found gets one row saying
 * so. Weak matches stay in (flagged) but are not ranked, so rank 1 is always a trustworthy offer.
 */
export function comparisonRows(results: ItemResult[]): Cell[][] {
  return results.flatMap(({ item, offers, errors }) => {
    const problems = errors.map((e) => `${e.supplier}: ${e.error}`).join("\n");
    const head = [item.ref, itemLabel(item), item.quantity ?? "", item.unit];
    if (offers.length === 0) {
      return [[...head, "", "No offers found", "", "", "", "", "", "", "", "", "", "", "", problems]];
    }
    let rank = 0;
    return offers.map((o, i) => {
      const ranked = o.match !== "weak" && o.unitPriceBase !== null;
      const total = o.unitPriceBase !== null && item.quantity !== null ? o.unitPriceBase * item.quantity : null;
      return [
        ...head,
        ranked ? ++rank : "",
        supplierLabel(o),
        o.match,
        o.unitPriceBase === null && o.unitPrice === null ? `${o.matchNote} (pack size unclear)` : o.matchNote,
        o.title,
        `${o.packQty} ${o.packUnit}`,
        o.price,
        o.currency,
        round2(o.unitPriceBase),
        round2(total),
        o.availability,
        o.url,
        utc(o.fetchedAt),
        i === 0 ? problems : "",
      ];
    });
  });
}

// ─── Market Check (monitor mode) ────────────────────────────────────────────────────────────

export const POSITIONS = ["Overpriced", "Underpriced", "Competitive", "No market data", "No price set"] as const;
export type Position = (typeof POSITIONS)[number];

export function marketCheckTable(base: string): TableSpec {
  return {
    columns: [
      { header: "SKU", width: 130 },
      { header: "Item", width: 300 },
      { header: "Unit", width: 60, align: "CENTER" },
      { header: `Our cost (${base})`, width: 95, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: `Our price (${base})`, width: 95, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: `Market low (${base})`, width: 100, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: `Market median (${base})`, width: 110, align: "RIGHT", numberFormat: "#,##0.00" },
      { header: "Lowest supplier", width: 210 },
      { header: "Offers", width: 65, align: "CENTER" },
      { header: "Position", width: 120, align: "CENTER" },
      { header: "Buying", width: 260 },
      { header: "Note", width: 320 },
      { header: "Checked (UTC)", width: 125, align: "CENTER" },
    ],
    frozenColumns: 2,
    pills: [
      { column: "Position", condition: "TEXT_EQ", value: "Overpriced", bg: "#F4CCCC", fg: "#990000" },
      { column: "Position", condition: "TEXT_EQ", value: "Underpriced", bg: "#FFF2CC", fg: "#7F6000" },
      { column: "Position", condition: "TEXT_EQ", value: "Competitive", bg: "#D9EAD3", fg: "#274E13" },
      { column: "Position", condition: "TEXT_EQ", value: "No market data", bg: "#EFEFEF", fg: "#666666" },
      { column: "Position", condition: "TEXT_EQ", value: "No price set", bg: "#EFEFEF", fg: "#666666" },
    ],
  };
}

export type MarketPosition = {
  low: number | null;
  median: number | null;
  lowSupplier: string;
  count: number;
  position: Position;
  buying: string;
  note: string;
};

const cheapestOf = (offers: RankedOffer[]) =>
  offers.reduce<RankedOffer | null>((best, o) => (best === null || o.unitPriceBase! < best.unitPriceBase! ? o : best), null);

/**
 * Where our price sits against the market, from exact and likely matches with a comparable unit
 * price. Offers from another maker (an aftermarket part with the same part number) are left out
 * of the position, since they sell at a different quality tier, but still count as a buying tip.
 * Overpriced: above the median by more than the threshold. Underpriced: below the lowest offer by
 * more than the threshold (room to raise). Buying: a supplier sells below our cost.
 */
export function marketPosition(item: CatalogueItem, offers: RankedOffer[], thresholdPct: number, base: string): MarketPosition {
  const t = thresholdPct / 100;
  const priced = offers.filter((o) => o.match !== "weak" && o.unitPriceBase !== null);
  const maker = item.maker.trim().toLowerCase();
  const sameTier = priced.filter((o) => !maker || !o.maker || o.maker.trim().toLowerCase() === maker);
  const prices = sameTier.map((o) => o.unitPriceBase!).sort((a, b) => a - b);

  const weak = offers.length - priced.length;
  const otherMaker = priced.length - sameTier.length;
  const note = [
    weak > 0 && `${weak} weak or unpriced match${weak === 1 ? "" : "es"} not counted (see links in a requisition run)`,
    otherMaker > 0 && `${otherMaker} offer${otherMaker === 1 ? "" : "s"} from another maker not counted`,
  ]
    .filter(Boolean)
    .join("\n");

  const cheapestAny = cheapestOf(priced);
  const buying =
    cheapestAny && item.ourCost !== null && cheapestAny.unitPriceBase! < item.ourCost * (1 - t)
      ? `Cheaper source: ${supplierLabel(cheapestAny)} at ${cheapestAny.unitPriceBase!.toFixed(2)} ${base}${cheapestAny.maker && cheapestAny.maker.trim().toLowerCase() !== maker && maker ? ` (${cheapestAny.maker})` : ""} (our cost ${item.ourCost.toFixed(2)})`
      : "";

  if (prices.length === 0) {
    return { low: null, median: null, lowSupplier: "", count: 0, position: "No market data", buying, note };
  }
  const low = prices[0]!;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid]! : (prices[mid - 1]! + prices[mid]!) / 2;

  let position: Position = "Competitive";
  if (item.ourPrice === null) position = "No price set";
  else if (item.ourPrice > median * (1 + t)) position = "Overpriced";
  else if (item.ourPrice < low * (1 - t)) position = "Underpriced";

  return { low, median, lowSupplier: supplierLabel(cheapestOf(sameTier)!), count: prices.length, position, buying, note };
}

export function marketCheckRows(
  results: { item: CatalogueItem; offers: RankedOffer[]; errors: ItemResult["errors"] }[],
  thresholdPct: number,
  base: string,
  checkedAt: string,
): Cell[][] {
  return results.map(({ item, offers, errors }) => {
    const m = marketPosition(item, offers, thresholdPct, base);
    const problems = errors.map((e) => `${e.supplier}: ${e.error}`);
    return [
      item.ref,
      itemLabel(item),
      item.unit,
      item.ourCost ?? "",
      item.ourPrice ?? "",
      round2(m.low),
      round2(m.median),
      m.lowSupplier,
      m.count,
      m.position,
      m.buying,
      [m.note, ...problems].filter(Boolean).join("\n"),
      utc(checkedAt),
    ];
  });
}

// ─── Run Log ────────────────────────────────────────────────────────────────────────────────

export const RUN_LOG_TABLE: TableSpec = {
  columns: [
    { header: "Run (UTC)", width: 125, align: "CENTER" },
    { header: "Mode", width: 110, align: "CENTER" },
    { header: "Items", width: 60, align: "CENTER" },
    { header: "Offers", width: 65, align: "CENTER" },
    { header: "Suppliers", width: 320 },
    { header: "Problems", width: 380 },
    { header: "Claude calls", width: 75, align: "CENTER" },
    { header: "Tokens in / out", width: 120, align: "CENTER" },
  ],
  frozenColumns: 1,
};

// ─── Cache (hidden) ─────────────────────────────────────────────────────────────────────────

export const CACHE_TABLE: TableSpec = {
  columns: [
    { header: "Key", width: 300 },
    { header: "Saved (UTC ISO)", width: 180 },
    { header: "Offers (JSON)", width: 400 },
  ],
  frozenColumns: 0,
};
