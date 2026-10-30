import { normalizeCode } from "../match.js";
import type { Item, Offer, Source, SupplierConfig } from "../types.js";
import { MOCK_PRODUCTS, type MockCategory, type MockProduct } from "./mock-catalogue.js";

// Mock exchange rates (units per 1 USD), only to price mock offers in a supplier's own currency.
const MOCK_PER_USD: Record<string, number> = { USD: 1, SGD: 1.35, EUR: 0.92, PHP: 58 };

const STOPWORDS = new Set(["and", "for", "the", "with", "of", "x", "pcs", "pc", "inch", "mm", "kg"]);

/** Stable hash, so a mock supplier always stocks the same products at the same prices. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Products a supplier website search would return for the item: code hits, or most words in common. */
function searchCatalogue(item: Item, products: MockProduct[]): MockProduct[] {
  const impa = normalizeCode(item.impa);
  const pn = normalizeCode(item.partNumber);
  const wanted = words(item.description);
  return products
    .map((p) => {
      if (impa && normalizeCode(p.impa) === impa) return { p, score: 2 };
      if (pn && normalizeCode(p.partNumber) === pn) return { p, score: 2 };
      if (wanted.length === 0) return { p, score: 0 };
      const title = new Set(words(p.title));
      return { p, score: wanted.filter((w) => title.has(w)).length / wanted.length };
    })
    .filter(({ score }) => score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ p }) => p);
}

/**
 * A pretend supplier website for testing. Settings (Suppliers tab, Settings column):
 *   categories=stores,provisions,spares   what it sells (default: everything)
 *   simulate=down                         every search fails (tests failure handling)
 *   simulate=slow                         every search hangs past its timeout
 *   timeoutSeconds=N                      give up on one item after N seconds (default 20)
 */
export class MockSource implements Source {
  readonly cacheable = false;
  readonly timeoutSeconds: number;
  private readonly products: MockProduct[];

  constructor(readonly supplier: SupplierConfig) {
    this.timeoutSeconds = Number(supplier.settings.timeoutSeconds) || 20;
    const categories = (supplier.settings.categories ?? "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean) as MockCategory[];
    // Each supplier stocks about three quarters of its categories' products.
    this.products = MOCK_PRODUCTS.filter(
      (p) => (categories.length === 0 || categories.includes(p.category)) && hash(`${supplier.name}|${p.id}`) % 100 < 75,
    );
  }

  async search(item: Item): Promise<Offer[]> {
    const simulate = (this.supplier.settings.simulate ?? "").toLowerCase();
    if (simulate === "down") throw new Error("Connection refused (simulated outage)");
    if (simulate === "slow") await new Promise((resolve) => setTimeout(resolve, (this.timeoutSeconds + 30) * 1000));
    // A little latency, like a real site.
    await new Promise((resolve) => setTimeout(resolve, 50 + (hash(this.supplier.name + item.ref) % 200)));

    const currency = this.supplier.currency.toUpperCase();
    const perUsd = MOCK_PER_USD[currency] ?? 1;
    const fetchedAt = new Date().toISOString();
    return searchCatalogue(item, this.products).map((p) => {
      const h = hash(`${this.supplier.name}|${p.id}|price`);
      // Each supplier sells within -15% to +25% of the typical price.
      const price = Math.round(p.basePriceUsd * (0.85 + (h % 41) / 100) * perUsd * 100) / 100;
      const slug = p.id.toLowerCase();
      return {
        supplier: this.supplier.name,
        mock: true,
        title: p.title,
        impa: p.impa,
        partNumber: p.partNumber,
        maker: p.maker,
        price,
        currency,
        packQty: p.packQty,
        packUnit: p.packUnit,
        availability: ["In stock", "2-3 days", "On request"][h % 3]!,
        url: `${this.supplier.url.replace(/\/$/, "")}/products/${slug}`,
        fetchedAt,
      };
    });
  }
}
