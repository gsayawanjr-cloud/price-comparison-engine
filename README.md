# Price Comparison

Looks up market prices for ship stores, provisions and spare parts at every enabled supplier and
writes the results to a Google Sheet. Runs on Trigger.dev. One engine, two jobs:

| Task | What it does | Output tab |
|---|---|---|
| `compare-requisition` | Prices every line in the **Requisition** tab, cheapest trustworthy offer first | **Comparison** |
| `weekly-market-check` | Every Monday 06:00 Manila: checks every **Catalogue** item against the market | **Market Check** |
| `setup-price-sheet` | Creates and formats all tabs; adds starter rows to empty tabs only | all |

Every run also adds a line to **Run Log** (suppliers used, problems, Claude usage).

## How matching works

- **Same IMPA/ISSA code or part number** = `exact` (same part number from another maker = `likely`,
  for example an aftermarket equivalent). A different code = not the item, dropped.
- **Free text** is judged by Claude: `exact`, `likely`, `weak` or no match. Without
  `ANTHROPIC_API_KEY` these are all listed as `weak` for a person to check.
- **Pack sizes** are converted to the item's unit, so a 25 kg bag and a 5 kg bag compare per kg.
- **Currencies** are converted to `BASE_CURRENCY` with `FX_RATES`.
- `weak` offers are shown but never ranked. Market Check counts only `exact` and `likely` offers
  from the same maker; cheaper other-maker parts appear as a buying tip.

## Suppliers

Edit the **Suppliers** tab; no code change is needed to add, remove or switch off a supplier.

| Type | Use for |
|---|---|
| `mock` | Pretend suppliers for testing. Settings: `categories=stores,provisions,spares`, `simulate=down` or `slow` |
| `web-research` | Claude searches the web. `domains=site.com` limits it to one supplier's site. Costs Claude credits per item; results are reused for `CACHE_TTL_HOURS` |
| `scraper` | A real supplier site with code written for it (see below) |

**Adding a real supplier with a scraper:** copy `src/trigger/price-compare/sources/scrapers/_template.ts`,
fill in `search()`, register it in `scrapers/index.ts`, and add a Suppliers row with Type `scraper`
and its key in the Scraper column.

**Going live with real suppliers:** set Mock to "No" on real rows and `INCLUDE_MOCK_SUPPLIERS=false`,
so mock prices never mix into real reports.

## Setup

1. `npm install`, then copy `.env.example` to `.env` and fill it in.
2. Create a **separate** Trigger.dev project for this workflow and put its ref in `trigger.config.ts`.
3. Create a Google Sheet, share it with the service account's `client_email` as Editor, and put its
   ID in `PRICE_SHEET_ID`.
4. `npm run dev`, then run `setup-price-sheet` from the dashboard, then `compare-requisition`.

`npm run smoke` checks the engine offline against the mock suppliers (no sheet or Trigger.dev needed).
