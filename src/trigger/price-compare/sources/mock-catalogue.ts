// MOCK DATA for testing. Codes, part numbers and prices are made up (the part numbers line up
// with the RFQ agent's mock inventory). Mock suppliers each "stock" a share of these products at
// their own prices, so a comparison has real differences to rank.

export type MockCategory = "stores" | "provisions" | "spares";

export type MockProduct = {
  id: string;
  category: MockCategory;
  impa: string;
  partNumber: string;
  maker: string;
  title: string;
  packQty: number;
  packUnit: string;
  /** Typical USD price of one pack; each mock supplier moves it up or down. */
  basePriceUsd: number;
};

type Row = [id: string, category: MockCategory, impa: string, partNumber: string, maker: string, title: string, packQty: number, packUnit: string, basePriceUsd: number];

const rows: Row[] = [
  // ── Deck and engine stores ────────────────────────────────────────────────────────────────
  ["ST-01", "stores", "190112", "", "", "Polypropylene rope, 3-strand, 12 mm x 220 m coil", 1, "coil", 68],
  ["ST-02", "stores", "232216", "", "", "Cotton waste, white, 10 kg bale", 10, "kg", 24],
  ["ST-03", "stores", "", "", "", "Cotton waste, white, 25 kg bale", 25, "kg", 52],
  ["ST-04", "stores", "450301", "", "", "Paint brush, flat, 50 mm", 1, "pc", 2.1],
  ["ST-05", "stores", "370101", "", "", "Safety helmet, white, with chin strap", 1, "pc", 9.5],
  ["ST-06", "stores", "150711", "", "", "Nitrile gloves, heavy duty, size L", 1, "pair", 1.8],
  ["ST-07", "stores", "", "", "", "Nitrile gloves, heavy duty, size L, box of 12 pairs", 12, "pair", 19],
  ["ST-08", "stores", "471011", "", "", "Bow shackle, galvanised, 1/2 inch", 1, "pc", 4.2],
  ["ST-09", "stores", "550101", "", "", "Fire hose 2 inch x 20 m with Storz couplings", 1, "pc", 145],
  ["ST-10", "stores", "611101", "", "", "LED bulb E27 230V 10W", 1, "pc", 3.4],
  ["ST-11", "stores", "175511", "", "", "Toilet paper, 2-ply, pack of 48 rolls", 48, "roll", 21],
  // ── Provisions ────────────────────────────────────────────────────────────────────────────
  ["PR-01", "provisions", "000111", "", "", "Rice, long grain, 25 kg bag", 25, "kg", 31],
  ["PR-02", "provisions", "", "", "", "Rice, long grain, 5 kg bag", 5, "kg", 7.4],
  ["PR-03", "provisions", "000215", "", "", "Chicken breast, boneless, frozen, 10 kg box", 10, "kg", 58],
  ["PR-04", "provisions", "", "", "", "Chicken breast fillet, fresh, 2 kg tray", 2, "kg", 14.5],
  ["PR-05", "provisions", "000302", "", "", "Eggs, fresh, tray of 30", 30, "pc", 5.6],
  ["PR-06", "provisions", "000405", "", "", "Cooking oil, vegetable, 18 L tin", 18, "l", 39],
  ["PR-07", "provisions", "000512", "", "", "Coffee, ground, 1 kg pack", 1, "kg", 12.5],
  ["PR-08", "provisions", "000601", "", "", "Sugar, white, 50 kg sack", 50, "kg", 44],
  ["PR-09", "provisions", "", "", "", "Sugar, white, 1 kg pack", 1, "kg", 1.1],
  ["PR-10", "provisions", "000710", "", "", "Drinking water, 1.5 L bottle, case of 12", 12, "bottle", 4.8],
  // ── Spare parts ───────────────────────────────────────────────────────────────────────────
  ["SP-01", "spares", "", "90910-0101-150", "MAN B&W", "Fuel valve nozzle (atomizer), S50MC-C", 1, "pc", 640],
  ["SP-02", "spares", "", "90910-0101-150", "Marine Parts Co.", "Atomizer for MAN B&W S50MC-C fuel valve, aftermarket", 1, "pc", 295],
  ["SP-03", "spares", "", "146673-92000", "Yanmar", "Top overhaul gasket set, 6EY18ALW (1 cylinder)", 1, "set", 190],
  ["SP-04", "spares", "", "1.0021.1", "Boll & Kirch", "Filter candle element, 34 µm, automatic lub oil filter", 1, "pc", 61],
  ["SP-05", "spares", "", "TH-100-120-B", "Wika", "Dial thermometer 0-120 °C, back entry, 100 mm", 1, "pc", 44],
  ["SP-06", "spares", "", "PG-100-10-BT", "Wika", "Pressure gauge 0-10 bar, 100 mm, bottom entry, glycerine-filled", 1, "pc", 35],
  ["SP-07", "spares", "", "MS-35-CW", "Burgmann", "Mechanical seal M7N, 35 mm shaft", 1, "pc", 270],
];

export const MOCK_PRODUCTS: MockProduct[] = rows.map(([id, category, impa, partNumber, maker, title, packQty, packUnit, basePriceUsd]) => ({
  id,
  category,
  impa,
  partNumber,
  maker,
  title,
  packQty,
  packUnit,
  basePriceUsd,
}));
