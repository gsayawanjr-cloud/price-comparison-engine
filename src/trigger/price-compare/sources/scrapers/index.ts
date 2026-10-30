import type { Source, SupplierConfig } from "../../types.js";

/**
 * Scrapers for real supplier websites, by the key used in the Suppliers tab's "Scraper" column.
 *
 * To add a supplier:
 *   1. Copy _template.ts to <supplier-key>.ts and fill in its search().
 *   2. Register it below, e.g.  "harbour-marine": (s) => new HarbourMarineScraper(s),
 *   3. In the Suppliers tab add a row: Type "scraper", Scraper "harbour-marine", Mock "No", Enabled "Yes".
 *
 * Suppliers without a usable website don't need a scraper: give them Type "web-research" with
 * Settings "domains=theirsite.com", and Claude reads their pages instead.
 */
export const SCRAPERS: Record<string, (supplier: SupplierConfig) => Source> = {
  // "harbour-marine": (s) => new HarbourMarineScraper(s),
};
