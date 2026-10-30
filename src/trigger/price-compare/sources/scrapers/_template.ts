// TEMPLATE for a real supplier scraper. Not registered: copy it, rename the class, fill in search().
import type { Item, Offer, Source, SupplierConfig } from "../../types.js";

export class TemplateScraper implements Source {
  // Cache results when the site is slow or rate-limits; plain HTML sites can skip it.
  readonly cacheable = false;
  readonly timeoutSeconds: number;

  constructor(readonly supplier: SupplierConfig) {
    this.timeoutSeconds = Number(supplier.settings.timeoutSeconds) || 30;
  }

  async search(item: Item): Promise<Offer[]> {
    // Search by the most specific thing the item has: code, then part number, then description.
    const query = item.impa || item.partNumber || item.description;
    const url = `${this.supplier.url.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (price comparison)" } });
    if (!response.ok) throw new Error(`${this.supplier.name} search returned ${response.status}`);

    // Most supplier sites have a JSON search endpoint (check the browser's network tab) or
    // listings in HTML. Parse each listing into an Offer. Never guess a price: skip listings
    // without one.
    const listings: { title: string; price: number; link: string }[] = [];
    void (await response.text());

    const fetchedAt = new Date().toISOString();
    return listings.map((l) => ({
      supplier: this.supplier.name,
      mock: this.supplier.mock,
      title: l.title,
      impa: "",
      partNumber: "",
      maker: "",
      price: l.price,
      currency: this.supplier.currency,
      // Read the pack size from the listing ("25 kg bag" → 25, "kg"); 1 × pc when it sells single items.
      packQty: 1,
      packUnit: "pc",
      availability: "",
      url: l.link,
      fetchedAt,
    }));
  }
}
