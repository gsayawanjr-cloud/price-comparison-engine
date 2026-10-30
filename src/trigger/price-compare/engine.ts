import { logger } from "@trigger.dev/sdk";
import type { AiConfig, FxTable } from "./config.js";
import { normalizeCode, normalizeUnit, rankOffers } from "./match.js";
import type { Item, ItemResult, Offer, Source, SourceError } from "./types.js";

/** Reuses earlier search results for slow or paid sources. */
export interface OfferCache {
  get(key: string): Offer[] | undefined;
  set(key: string, offers: Offer[]): void;
}

export type EngineOptions = {
  sources: Source[];
  ai: AiConfig | null;
  fx: FxTable;
  cache?: OfferCache;
  /** Items looked up at once. Each item already queries every source in parallel. */
  concurrency?: number;
};

export function cacheKey(supplier: string, item: Item): string {
  return [supplier, normalizeCode(item.impa), normalizeCode(item.partNumber), item.maker.trim().toLowerCase(), item.description.trim().toLowerCase(), normalizeUnit(item.unit)].join("|");
}

function withTimeout<T>(promise: Promise<T>, seconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer within ${seconds} s`)), seconds * 1000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function searchOne(source: Source, item: Item, cache: OfferCache | undefined): Promise<Offer[]> {
  const key = cacheKey(source.supplier.name, item);
  if (source.cacheable && cache) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  const offers = await withTimeout(source.search(item), source.timeoutSeconds);
  if (source.cacheable && cache) cache.set(key, offers);
  return offers;
}

/** Runs `work` over `items`, at most `limit` at a time, keeping the input order. */
async function mapLimit<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Looks every item up at every source and ranks what comes back. A source that fails or times out
 * is recorded against that item and the rest carry on, so one broken supplier never stops a run.
 */
export async function compareItems(items: Item[], options: EngineOptions): Promise<ItemResult[]> {
  return mapLimit(items, options.concurrency ?? 4, async (item) => {
    const errors: SourceError[] = [];
    const found = await Promise.all(
      options.sources.map(async (source) => {
        try {
          return await searchOne(source, item, options.cache);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ supplier: source.supplier.name, item: item.ref, error: message });
          logger.warn("Supplier lookup failed", { supplier: source.supplier.name, item: item.ref, error: message });
          return [];
        }
      }),
    );
    const offers = await rankOffers(item, found.flat(), options.ai, options.fx);
    return { item, offers, errors };
  });
}
