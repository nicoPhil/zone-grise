import { FREE, KEYS, def, mk, price, slotOf, upgradeOver, valOf, wearable, type Item, type ItemKey } from "./items";
import { BENCH, MAX_LV, UP, canPay, pay, type Cost } from "./progression";
import { S, type Stations, type Upgrades } from "./state";
import { roll } from "./rolls";
import { pick } from "./util";

// figures tuned with the economy simulation (sim/, variant "game"): the hideout takes ~95 raids to finish

/** Share of an item's value the merchant pays, by rarity: rare finds from deep zones sell better. */
export const SELL_R = [0.3, 0.35, 0.45, 0.6];
export const PART_SELL = 0.6;

export const saleOf = (it: Item) => {
  const d = def(it.k);
  return Math.round(valOf(it) * (d.t === "part" ? PART_SELL : SELL_R[d.r]));
};

const ELEC = new Set<ItemKey>(["batt", "torch", "radio", "hdd", "gpu", "milbat", "laptop"]);

/** The common materials an item breaks down into, or null when it can't be recycled. */
export function recycleOf(k: ItemKey): Partial<Record<ItemKey, number>> | null {
  const d = def(k),
    n = 1 + d.r;
  if (d.t === "wpn") return d.mel ? { scrap: n, tape: 1 } : { scrap: n, bolts: n };
  if (d.t === "gear") return { tape: n, scrap: 1 + Math.floor(d.r / 2) };
  if (d.t === "shield") return { batt: n, wires: n };
  if (d.t === "val" && ELEC.has(k)) return { wires: n, batt: 1 };
  return null;
}

export const recycled = (k: ItemKey): Item[] =>
  Object.entries(recycleOf(k) || {}).flatMap(([m, n]) => Array.from({ length: n || 0 }, () => mk(m as ItemKey)));

const c = (cr: number, it: Cost["it"]): Cost => ({ cr, it });

interface Station {
  n: string;
  /** what each level gives, level 0 first */
  lv: string[];
  cost: Cost[];
}

export const STATIONS: Record<keyof Stations, Station> = {
  bench: {
    n: "Établi",
    lv: [
      "aucune amélioration ni recette",
      "améliorations +1 · recettes niv. 1",
      "améliorations +2 · recettes niv. 2",
      "améliorations +3 · recettes niv. 3",
    ],
    cost: [
      c(1800, { scrap: 6, bolts: 4, gunparts: 3 }),
      c(7200, { wires: 6, gas: 3, bolt: 2 }),
      c(18000, { milbat: 3, scope: 2, fang: 2 }),
    ],
  },
  pocket: {
    n: "Poche sécurisée",
    lv: ["rien n'est gardé à la mort", "1 place du sac gardée à la mort", "2 places gardées à la mort", "3 places gardées à la mort"],
    cost: [c(1800, { tape: 4, gland: 4 }), c(7200, { gas: 2, hdd: 2 }), c(21600, { milbat: 2, gold: 2 })],
  },
  trade: {
    n: "Comptoir",
    lv: ["arrivages communs", "arrivages jusqu'à peu commun", "arrivages jusqu'à rare", "arrivages jusqu'à épique"],
    cost: [c(2400, { flesh: 6, cigs: 2 }), c(9600, { bolt: 4, watch: 2 }), c(24000, { scope: 3, jewels: 2 })],
  },
  store: {
    n: "Réserve",
    lv: ["coffre de 10 cases", "coffre de 50 cases", "coffre de 80 cases", "coffre de 120 cases"],
    cost: [c(1500, { scrap: 6, tape: 4 }), c(6000, { wires: 6, bolts: 6 }), c(15000, { milbat: 2, plate: 2 })],
  },
};

/** Stash cases at each store level; a worn-slot piece takes a case, other identical items stack by STACK. */
export const CASES = [10, 50, 80, 120];
export const STACK = 10;

/** Cases these items take in the stash. */
export function casesOf(items: Item[]): number {
  const piles = new Map<string, number>();
  let pieces = 0;
  for (const it of items)
    if (slotOf(it) || it.q !== undefined) pieces++;
    else piles.set(it.k, (piles.get(it.k) || 0) + 1);
  return pieces + [...piles.values()].reduce((s, n) => s + Math.ceil(n / STACK), 0);
}

export const stashRoom = () => CASES[S.sta.store];
export const stashOver = () => casesOf(S.stash) > stashRoom();
/** Whether one more item still fits in the stash. */
export const fits = (it: Item) => casesOf([...S.stash, it]) <= stashRoom();

/** Sells every valuable no contract, next upgrade, next station level or open recipe asks for; returns the credits made. */
export function sellValuables(): number {
  const need = needs();
  const sold = S.stash.filter((i) => def(i.k).t === "val" && !need.has(i.k));
  const cr = sold.reduce((s, i) => s + saleOf(i), 0);
  S.stash = S.stash.filter((i) => !sold.includes(i));
  S.credits += cr;
  return cr;
}

export interface Recipe {
  out: ItemKey;
  /** bench level it needs */
  bench: number;
  cost: Cost;
}

const r = (out: ItemKey, bench: number, cost: Cost): Recipe => ({ out, bench, cost });

// components by zone: flesh, gland, gunparts everywhere; gas from the Zone industrielle; bolt from the Cœur;
// plate and scope from the Quarantaine; skin and fang at the Épicentre
export const RECIPES: Recipe[] = [
  r("gen2", 1, c(200, { batt: 3, wires: 2, gland: 2 })),
  r("vest2", 1, c(400, { gunparts: 3, scrap: 4, tape: 2 })),
  r("helmet", 2, c(500, { gunparts: 2, scrap: 4, gas: 2 })),
  r("gen3", 2, c(800, { milbat: 1, gas: 3, wires: 4 })),
  r("carbine", 2, c(600, { gunparts: 4, bolt: 2, scrap: 4 })),
  r("ar", 2, c(800, { gunparts: 4, bolt: 3 })),
  r("gen4", 3, c(2500, { milbat: 2, scope: 2, fang: 1 })),
  r("dmr", 3, c(2000, { scope: 2, bolt: 3, gunparts: 4 })),
  r("armor", 3, c(2500, { plate: 4, skin: 2 })),
  r("reddot1", 1, c(300, { gunparts: 3, scrap: 3 })),
  r("spring1", 1, c(300, { gunparts: 3, bolts: 4 })),
  r("silencer2", 2, c(700, { bolt: 2, gunparts: 3 })),
  r("heavy2", 2, c(700, { bolt: 2, scrap: 6 })),
  r("scope3", 3, c(2000, { scope: 2, gunparts: 4 })),
  r("trigger3", 3, c(2000, { fang: 1, bolt: 3 })),
];

/** Bench cost of the next level of a piece: rarer pieces cost more to improve. */
export function benchCost(it: Item): Cost {
  const base = BENCH[it.lv || 0],
    f = 1 + 0.5 * def(it.k).r;
  return {
    cr: Math.round(base.cr * f),
    it: Object.fromEntries(Object.entries(base.it).map(([k, n]) => [k, Math.max(1, Math.round((n || 0) * f))])),
  };
}

/** Why a piece can't go up a bench level, or null when it can. */
export function benchBlock(it: Item): string | null {
  const lv = it.lv || 0;
  if (lv >= MAX_LV) return "Max";
  return lv >= S.sta.bench ? `Établi niv. ${lv + 1}` : null;
}

export const STOCK = 4;

/** Draws the merchant's rotating pieces once per raid played, up to the rarity the trade post allows. */
export function restock() {
  if (S.stock.raid === S.st.raids) return;
  const pool = KEYS.filter((k) => (wearable(k) || def(k).t === "att") && k !== FREE && def(k).r <= S.sta.trade);
  S.stock = { raid: S.st.raids, items: Array.from({ length: STOCK }, () => roll(mk(pick(pool)))) };
}

/** What the secure pocket saves from a lost bag: the most valuable items that fit its places. */
export function pocketed(bag: Item[]): Item[] {
  const kept: Item[] = [];
  let room = S.sta.pocket;
  for (const it of [...bag].sort((a, b) => valOf(b) - valOf(a)))
    if (def(it.k).s <= room) {
      kept.push(it);
      room -= def(it.k).s;
    }
  return kept;
}

/** A player left with no gun, none in the stash and too little to buy one gets a pistol; true when it was given. */
export function freeKit(): boolean {
  const hasGun = S.lo.eq.gun || S.stash.some((i) => slotOf(i) === "gun");
  if (hasGun || S.credits >= price("p9")) return false;
  S.lo.eq.gun = mk("p9");
  return true;
}

/** The next level of every upgrade, station and bench improvement still to buy. */
function nextCosts(): Cost[] {
  const ups = (Object.keys(UP) as (keyof Upgrades)[]).filter((k) => S.up[k] < MAX_LV).map((k) => UP[k].cost[S.up[k]]);
  const sta = (Object.keys(STATIONS) as (keyof Stations)[]).map((k) => STATIONS[k].cost[S.sta[k]]);
  const bench = [S.lo.eq.gun, S.lo.eq.blade, S.lo.eq.shield].flatMap((w) => (w && !benchBlock(w) ? [benchCost(w)] : []));
  return [...ups, ...sta, ...bench].filter((c): c is Cost => !!c);
}

/** Items a contract, the next upgrade, the next station level or an open recipe asks for, and why. */
export function needs(): Map<ItemKey, string> {
  const n = new Map<ItemKey, string>();
  const add = (cost: Cost, why: string) => {
    for (const k of Object.keys(cost.it) as ItemKey[]) if (!n.has(k)) n.set(k, why);
  };
  for (const q of S.q) if (q.t === "bring" && q.k) n.set(q.k, "contrat");
  for (const c of nextCosts()) add(c, "atelier");
  for (const rc of RECIPES) if (rc.bench <= S.sta.bench && upgradeOver(mk(rc.out), S.lo.eq)) add(rc.cost, "fabrication");
  return n;
}

/** Builds the next level of a station; false when it is maxed or can't be paid. */
export function build(k: keyof Stations): boolean {
  const cost = STATIONS[k].cost[S.sta[k]];
  if (!cost || !canPay(cost)) return false;
  pay(cost);
  S.sta[k]++;
  return true;
}

/** Makes a recipe's item into the stash; false when the bench is too low or it can't be paid. */
export function craft(rc: Recipe): boolean {
  if (rc.bench > S.sta.bench || !canPay(rc.cost)) return false;
  pay(rc.cost);
  S.stash.push(roll(mk(rc.out)));
  return true;
}

/** Takes a piece up one bench level; false when the bench station or the cost stops it. */
export function improve(it: Item): boolean {
  if (benchBlock(it) || !canPay(benchCost(it))) return false;
  pay(benchCost(it));
  it.lv = (it.lv || 0) + 1;
  return true;
}
