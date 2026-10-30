// SAMPLE input for testing: a mixed requisition (IMPA codes, part numbers, free text) and a small
// catalogue with our own cost and price. Written to the sheet by setup-price-sheet only when the
// tabs are empty; after that, the sheet is the source of truth.
import type { Cell } from "./sheet.js";

/** Line, IMPA / ISSA, Part No., Maker, Description, Qty, Unit */
export const SAMPLE_REQUISITION: Cell[][] = [
  [1, "190112", "", "", "PP rope 3-strand 12mm coil", 2, "coil"],
  [2, "000111", "", "", "Rice long grain", 100, "kg"],
  [3, "", "90910-0101-150", "MAN B&W", "Fuel valve nozzle, ME S50MC-C", 4, "pcs"],
  [4, "", "", "", "Chicken breast boneless frozen", 40, "kg"],
  [5, "", "", "", "White sugar", 20, "kg"],
  [6, "", "146673-92000", "Yanmar", "Top overhaul gasket set, aux engine 6EY18ALW", 2, "set"],
  [7, "150711", "", "", "Nitrile gloves heavy duty L", 50, "pair"],
  [8, "", "", "", "Toilet paper rolls", 96, "rolls"],
  [9, "", "", "", "Bow shackle galvanised 1/2 inch", 10, "pcs"],
  [10, "", "XYZ-0000", "Unknown Maker", "Item no supplier carries", 1, "pc"],
];

/** SKU, IMPA / ISSA, Part No., Maker, Description, Unit, Our cost per unit, Our price per unit */
export const SAMPLE_CATALOGUE: Cell[][] = [
  ["ST-ROPE-12", "190112", "", "", "Polypropylene rope 3-strand 12 mm, 220 m coil", "coil", 58, 95],
  ["PR-RICE-LG", "000111", "", "", "Rice, long grain", "kg", 1.3, 1.4],
  ["SP-MB-NZ-150", "", "90910-0101-150", "MAN B&W", "Fuel valve nozzle (atomizer) S50MC-C", "pc", 610, 720],
  ["PR-SUGAR-W", "", "", "", "Sugar, white", "kg", 1.05, 1.25],
  ["ST-GLOVE-NL", "150711", "", "", "Nitrile gloves heavy duty, size L", "pair", 1.6, 1.2],
  ["SP-YM-GS-18", "", "146673-92000", "Yanmar", "Top overhaul gasket set 6EY18ALW", "set", 150, 230],
];
