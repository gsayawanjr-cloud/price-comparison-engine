import type { OfferCache } from "./engine.js";
import type { SheetClient } from "./sheet.js";
import { CACHE_TABLE } from "./tables.js";
import type { Offer } from "./types.js";

export const CACHE_TAB = "_Cache";

/**
 * Search results kept in a hidden tab, so paid lookups (web research) are reused across runs for
 * CACHE_TTL_HOURS. Loaded once per run and written back once at the end.
 */
export class SheetCache implements OfferCache {
  private dirty = false;

  private constructor(
    private readonly sheet: SheetClient,
    private readonly entries: Map<string, { savedAt: string; offers: Offer[] }>,
  ) {}

  static async load(sheet: SheetClient, ttlHours: number): Promise<SheetCache> {
    await sheet.ensureTab(CACHE_TAB, { hidden: true });
    await sheet.putValues(CACHE_TAB, "A1", [CACHE_TABLE.columns.map((c) => c.header)]);
    const cutoff = Date.now() - ttlHours * 3600_000;
    const entries = new Map<string, { savedAt: string; offers: Offer[] }>();
    for (const [key, savedAt, json] of await sheet.getValues(CACHE_TAB, "A2:C")) {
      if (!key || !savedAt || !json || Date.parse(savedAt) < cutoff) continue;
      try {
        entries.set(key, { savedAt, offers: JSON.parse(json) });
      } catch {
        // A hand-edited or cut-off cell: drop it, the item is simply searched again.
      }
    }
    return new SheetCache(sheet, entries);
  }

  get(key: string): Offer[] | undefined {
    return this.entries.get(key)?.offers;
  }

  set(key: string, offers: Offer[]): void {
    this.entries.set(key, { savedAt: new Date().toISOString(), offers });
    this.dirty = true;
  }

  /** Rewrites the tab with the entries still fresh (expired ones drop out). */
  async flush(): Promise<void> {
    if (!this.dirty) return;
    await this.sheet.clearValues(CACHE_TAB, "A2:C");
    const rows = [...this.entries].map(([key, e]) => [key, e.savedAt, JSON.stringify(e.offers)]);
    if (rows.length > 0) await this.sheet.putValues(CACHE_TAB, "A2", rows);
    this.dirty = false;
  }
}
