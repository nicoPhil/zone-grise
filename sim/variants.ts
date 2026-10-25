import type { Cost } from "../src/progression";
import { BASE, type Econ, type Recipe, type StationKey } from "./econ";

const c = (cr: number, it: Cost["it"]): Cost => ({ cr, it });
const r = (out: Recipe["out"], bench: number, cost: Cost): Recipe => ({ out, bench, cost });

// components by zone: flesh, gland, gunparts everywhere; gas from the Zone industrielle; bolt from the Cœur;
// plate and scope from the Quarantaine; skin and fang at the Épicentre
const RECIPES: Recipe[] = [
  r("gen2", 1, c(200, { batt: 3, wires: 2, gland: 2 })),
  r("vest2", 1, c(400, { gunparts: 3, scrap: 4, tape: 2 })),
  r("helmet", 2, c(500, { gunparts: 2, scrap: 4, gas: 2 })),
  r("gen3", 2, c(800, { milbat: 1, gas: 3, wires: 4 })),
  r("carbine", 2, c(600, { gunparts: 4, bolt: 2, scrap: 4 })),
  r("ar", 2, c(800, { gunparts: 4, bolt: 3 })),
  r("gen4", 3, c(2500, { milbat: 2, scope: 2, fang: 1 })),
  r("dmr", 3, c(2000, { scope: 2, bolt: 3, gunparts: 4 })),
  r("armor", 3, c(2500, { plate: 4, skin: 2 })),
];

export const V1: Econ = {
  name: "v1",
  sell: 0.35,
  partSell: 0.6,
  unlock: 5,
  upScale: 2,
  benchRarity: 1,
  stock: 4,
  recycle: true,
  questZone: 0.5,
  stations: {
    bench: [
      c(1500, { scrap: 6, bolts: 4, gunparts: 3 }),
      c(6000, { wires: 6, gas: 3, bolt: 2 }),
      c(20000, { milbat: 3, scope: 2, fang: 2 }),
    ],
    pocket: [c(2500, { tape: 4, gland: 4 }), c(9000, { gas: 4, hdd: 2 }), c(25000, { plate: 4, gold: 2 })],
    trade: [c(2000, { flesh: 6, cigs: 2 }), c(8000, { bolt: 4, watch: 2 }), c(30000, { scope: 3, jewels: 2 })],
  },
  recipes: RECIPES,
};

/** v1 with contracts paying less per zone, a cheaper pocket and one more extraction per zone. */
export const V2: Econ = {
  ...V1,
  name: "v2",
  questZone: 0.25,
  unlock: 6,
  stations: {
    ...V1.stations,
    pocket: [c(1500, { tape: 4, gland: 4 }), c(6000, { gas: 4, hdd: 2 }), c(18000, { gas: 6, gold: 2 })],
  },
};

export const V3: Econ = { ...V2, name: "v3", sell: 0.4 };

/** v3 with a cheaper bench on rare pieces, cheaper top stations and contracts gaining less per zone. */
export const V4: Econ = {
  ...V3,
  name: "v4",
  benchRarity: 0.5,
  questZone: 0.15,
  stations: {
    ...V3.stations,
    bench: [
      c(1500, { scrap: 6, bolts: 4, gunparts: 3 }),
      c(6000, { wires: 6, gas: 3, bolt: 2 }),
      c(15000, { milbat: 3, scope: 2, fang: 2 }),
    ],
    trade: [c(2000, { flesh: 6, cigs: 2 }), c(8000, { bolt: 4, watch: 2 }), c(20000, { scope: 3, jewels: 2 })],
  },
};

/** v4 with a pocket that no longer competes for gas pockets. */
export const V5: Econ = {
  ...V4,
  name: "v5",
  stations: {
    ...V4.stations,
    pocket: [c(1500, { tape: 4, gland: 4 }), c(6000, { gas: 2, hdd: 2 }), c(18000, { milbat: 2, gold: 2 })],
  },
};

/** v5 where rarer finds sell better, so the deep zones pay, and a free pistol for a player left with nothing. */
export const V6: Econ = { ...V5, name: "v6", sellR: [0.3, 0.35, 0.45, 0.6], freeKit: true };

const pricier = (e: Econ, f: number): Econ["stations"] =>
  Object.fromEntries(Object.entries(e.stations).map(([k, lv]) => [k as StationKey, lv?.map((x) => ({ ...x, cr: Math.round(x.cr * f) }))]));

/** v6 with lower resale below epic and stations 20 % dearer. */
export const V7: Econ = { ...V6, name: "v7", sellR: [0.25, 0.3, 0.4, 0.55], stations: pricier(V6, 1.2) };

/** v6's resale with v7's dearer stations. */
export const V8: Econ = { ...V6, name: "v8", stations: pricier(V6, 1.2) };

export const VARIANTS: Record<string, Econ> = { base: BASE, v1: V1, v2: V2, v3: V3, v4: V4, v5: V5, v6: V6, v7: V7, v8: V8 };
