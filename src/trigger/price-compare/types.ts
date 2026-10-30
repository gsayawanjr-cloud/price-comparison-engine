/** One line to price: a requisition line or a catalogue item. Empty strings mean "not given". */
export type Item = {
  /** Requisition line number or catalogue SKU, used to tie results back to the input row. */
  ref: string;
  /** IMPA or ISSA code. */
  impa: string;
  partNumber: string;
  maker: string;
  description: string;
  quantity: number | null;
  /** The unit the item is counted in (pc, kg, l, set, ...). Prices are compared per this unit. */
  unit: string;
};

/** A listing found at a supplier, as the supplier shows it. */
export type Offer = {
  supplier: string;
  mock: boolean;
  /** Listing title as shown by the supplier. */
  title: string;
  impa: string;
  partNumber: string;
  maker: string;
  /** Price of one pack, in `currency`. */
  price: number;
  currency: string;
  /** What one pack holds: packQty × packUnit (e.g. 25 × kg, 30 × pc, 1 × set). */
  packQty: number;
  packUnit: string;
  /** "In stock", "3-5 days", or "" when the supplier doesn't say. */
  availability: string;
  url: string;
  fetchedAt: string;
};

export type Match = "exact" | "likely" | "weak" | "no match";

export type RankedOffer = Offer & {
  match: Match;
  matchNote: string;
  /** One pack expressed in the item's unit (a 25 kg bag for an item counted in kg = 25), or null if unknown. */
  unitsPerPack: number | null;
  /** Price per item unit in the offer's currency. */
  unitPrice: number | null;
  /** Price per item unit in BASE_CURRENCY, or null when the unit or currency can't be converted. */
  unitPriceBase: number | null;
};

export type SupplierType = "mock" | "scraper" | "web-research";

/** One row of the Suppliers tab. */
export type SupplierConfig = {
  name: string;
  type: SupplierType;
  /** For type "scraper": the key of its scraper in sources/scrapers/index.ts. */
  scraper: string;
  url: string;
  currency: string;
  enabled: boolean;
  mock: boolean;
  /** "key=value; key=value" from the Settings column. */
  settings: Record<string, string>;
};

/** A place to look for prices. Each supplier row becomes one Source. */
export interface Source {
  readonly supplier: SupplierConfig;
  /** Results are reused for CACHE_TTL_HOURS. Worth it only for slow or paid lookups. */
  readonly cacheable: boolean;
  /** Seconds before the lookup for one item is abandoned. */
  readonly timeoutSeconds: number;
  search(item: Item): Promise<Offer[]>;
}

export type SourceError = { supplier: string; item: string; error: string };

export type ItemResult = { item: Item; offers: RankedOffer[]; errors: SourceError[] };
