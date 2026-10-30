// Offline end-to-end check of the engine against the mock suppliers. No Google Sheet or Trigger.dev
// needed. Uses Claude for free-text matching only when ANTHROPIC_API_KEY is set in the environment.
//   npm run smoke
import { strict as assert } from "node:assert";
import { aiConfig, parseFx } from "../src/trigger/price-compare/config.js";
import { compareItems } from "../src/trigger/price-compare/engine.js";
import { SAMPLE_CATALOGUE, SAMPLE_REQUISITION } from "../src/trigger/price-compare/samples.js";
import { buildSources, DEFAULT_SUPPLIERS, parseSupplierRows } from "../src/trigger/price-compare/suppliers.js";
import { comparisonRows, marketCheckRows, parseCatalogue, parseRequisition } from "../src/trigger/price-compare/tables.js";

const fx = parseFx("USD", "SGD=0.74,EUR=1.09,PHP=0.017");
const ai = aiConfig();
const items = parseRequisition(SAMPLE_REQUISITION);
const byLine = (results: Awaited<ReturnType<typeof compareItems>>, line: string) => results.find((r) => r.item.ref === line)!;

console.log(`Claude matching: ${ai ? `on (${ai.model})` : "off (no ANTHROPIC_API_KEY)"}\n`);

// 1. The default supplier rows: three mock suppliers on, the flaky one and web research off.
const rows = parseSupplierRows(DEFAULT_SUPPLIERS);
const { sources, setupErrors } = buildSources(rows, { ai: null, includeMock: true });
assert.equal(sources.length, 3, "three mock suppliers enabled by default");
assert.equal(setupErrors.length, 0);

const results = await compareItems(items, { sources, ai, fx });
console.table(
  comparisonRows(results).map((r) => ({ line: r[0], rank: r[4], supplier: r[5], match: r[6], unitUsd: r[12], totalUsd: r[13], listing: String(r[8]).slice(0, 45) })),
);

// Codes settle matches without Claude.
const rope = byLine(results, "1");
assert.ok(rope.offers.length > 0 && rope.offers.every((o) => o.match === "exact"), "rope: IMPA code matches are exact");
const nozzle = byLine(results, "3");
assert.ok(nozzle.offers.some((o) => o.match === "exact" && o.currency === "SGD"), "nozzle: OEM offer from the SGD supplier");
assert.ok(nozzle.offers.some((o) => o.match === "likely" && o.maker === "Marine Parts Co."), "nozzle: aftermarket same-P/N offer is 'likely'");
assert.ok(nozzle.offers.every((o) => o.unitPriceBase !== null), "SGD prices converted to USD");
// Pack sizes: a 25 kg rice bag for an item counted in kg is priced per kg.
const rice = byLine(results, "2").offers.find((o) => o.impa === "000111");
assert.ok(rice && rice.unitsPerPack === 25, "rice: 25 kg bag = 25 units");
// Unknown item: no offers, but still one output row saying so.
const unknown = byLine(results, "10");
assert.equal(unknown.offers.length, 0);
assert.ok(comparisonRows([unknown])[0]![5] === "No offers found");
// Ranking: exact/likely before weak, cheapest first.
for (const r of results) {
  const firstWeak = r.offers.findIndex((o) => o.match === "weak");
  if (firstWeak >= 0) assert.ok(r.offers.slice(firstWeak).every((o) => o.match === "weak"), `line ${r.item.ref}: weak matches last`);
}

// 2. Failure isolation: a supplier that is down, and one that hangs past its timeout.
const broken = parseSupplierRows([
  ...DEFAULT_SUPPLIERS.map((r) => (r[0]!.startsWith("Flaky") ? r.map((c, i) => (i === 5 ? "Yes" : c)) : r)),
  ["Slow Supplier (mock)", "mock", "", "https://slow.example", "USD", "Yes", "Yes", "simulate=slow; timeoutSeconds=1", ""],
  ["Bad Row", "scraper", "does-not-exist", "", "USD", "Yes", "No", "", ""],
]);
const withBroken = buildSources(broken, { ai: null, includeMock: true });
assert.equal(withBroken.setupErrors.length, 1, "unknown scraper reported, not thrown");
const twoItems = items.slice(0, 2);
const brokenResults = await compareItems(twoItems, { sources: withBroken.sources, ai: null, fx });
for (const r of brokenResults) {
  assert.ok(r.errors.some((e) => e.supplier.startsWith("Flaky") && /refused/.test(e.error)), "outage recorded per item");
  assert.ok(r.errors.some((e) => e.supplier.startsWith("Slow") && /within 1 s/.test(e.error)), "timeout recorded per item");
  assert.ok(r.offers.length > 0, "healthy suppliers still answered");
}
console.log("\nFailure isolation: OK (outage, timeout and bad row reported; other suppliers answered)");

// 3. Real-only mode skips every mock supplier.
assert.equal(buildSources(rows, { ai: null, includeMock: false }).sources.length, 0, "INCLUDE_MOCK_SUPPLIERS=false drops mocks");
console.log("Mock exclusion: OK");

// 4. Market check over the sample catalogue.
const catalogue = parseCatalogue(SAMPLE_CATALOGUE);
const catResults = await compareItems(catalogue, { sources, ai, fx });
const check = marketCheckRows(catResults.map((r, i) => ({ ...r, item: catalogue[i]! })), 10, "USD", new Date().toISOString());
console.log("\nMarket check:");
console.table(check.map((r) => ({ sku: r[0], ourPrice: r[4], low: r[5], median: r[6], position: r[9], buying: String(r[10]).slice(0, 60) })));
const position = (sku: string) => check.find((r) => r[0] === sku)![9];
assert.equal(position("ST-ROPE-12"), "Overpriced", "rope at 95 vs market around 68");
assert.equal(position("ST-GLOVE-NL"), "Underpriced", "gloves at 1.20 vs market around 1.80");
const nozzleCheck = check.find((r) => r[0] === "SP-MB-NZ-150")!;
assert.match(String(nozzleCheck[11]), /another maker not counted/, "aftermarket nozzle left out of the OEM position");
assert.match(String(nozzleCheck[10]), /Marine Parts Co\./, "aftermarket nozzle still shown as a buying tip");

if (ai) console.log(`\nClaude: ${ai.usage.calls} calls, ${ai.usage.inputTokens} in / ${ai.usage.outputTokens} out tokens`);
console.log("\nAll checks passed.");
// The simulated slow supplier leaves a timer running; don't wait for it.
process.exit(0);
