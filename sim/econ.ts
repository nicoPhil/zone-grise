import type { ItemKey } from "../src/items";
import { BENCH, UP, type Cost } from "../src/progression";

/** A hideout station the simulation adds on top of the game's three upgrades. */
export type StationKey = "pocket" | "bench" | "trade";
export interface Recipe {
  out: ItemKey;
  cost: Cost;
  /** bench station level it needs */
  bench: number;
}

/** An economy to try: the game's own (BASE) or a variant; nothing here changes the game. */
export interface Econ {
  name: string;
  /** share of an item's value the merchant pays, components apart */
  sell: number;
  /** when set, the share the merchant pays by rarity instead of `sell` */
  sellR?: number[];
  partSell: number;
  /** a free pistol for a player with no gun and not enough to buy one */
  freeKit?: boolean;
  /** extractions in a zone to open the next one */
  unlock: number;
  /** multiplier on the credits of the game's hideout upgrades */
  upScale: number;
  /** bench cost × (1 + benchRarity × rarity of the improved piece) */
  benchRarity: number;
  /** worn pieces the merchant offers on each visit, on top of the fixed shop; their rarity is capped by the trade station */
  stock: number;
  recycle: boolean;
  /** each level's cost; the bench station caps bench levels on pieces, the pocket keeps that many bag places at death */
  stations: Partial<Record<StationKey, Cost[]>>;
  recipes: Recipe[];
}

export const BASE: Econ = {
  name: "base",
  sell: 1,
  partSell: 1,
  unlock: 3,
  upScale: 1,
  benchRarity: 0,
  stock: 0,
  recycle: false,
  stations: {},
  recipes: [],
};

export let E: Econ = BASE;

/** Sim-only state of a career, beside the game's save. */
export const X = { st: { pocket: 0, bench: 0, trade: 0 } as Record<StationKey, number> };
export const resetX = () => {
  X.st = { pocket: 0, bench: 0, trade: 0 };
};

const ORIG = {
  up: Object.fromEntries(Object.entries(UP).map(([k, u]) => [k, u.cost.map((c) => c.cr)])),
};

/** Installs an economy for this process; the game's upgrade tables are rescaled in place. */
export function useEcon(e: Econ) {
  E = e;
  for (const [k, u] of Object.entries(UP)) for (const [i, c] of u.cost.entries()) c.cr = Math.round(ORIG.up[k][i] * e.upScale);
}

export const scaleCost = (c: Cost, f: number): Cost => ({
  cr: Math.round(c.cr * f),
  it: Object.fromEntries(Object.entries(c.it).map(([k, n]) => [k, Math.max(1, Math.round((n || 0) * Math.min(f, 2)))])),
});

export const benchCost = (lv: number, r: number) => scaleCost(BENCH[lv], 1 + E.benchRarity * r);
/** How far the bench can take a piece: the game's 3 levels, or the bench station's level when there is one. */
export const benchCap = () => (E.stations.bench ? X.st.bench : 3);
export const unlockedZone = (zx: number[], i: number) => i === 0 || zx[i - 1] >= E.unlock;
