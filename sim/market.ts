import { FREE, KEYS, def, mk, price, slotOf, upgradeOver, valOf, wearable, type Item, type ItemKey } from "../src/items";
import { canPay, pay, type Cost } from "../src/progression";
import { S } from "../src/state";
import { pick } from "../src/util";
import { E, X, type StationKey } from "./econ";

export const take = (it: Item) => S.stash.splice(S.stash.indexOf(it), 1);

/** What the merchant pays for an item. */
export const saleOf = (it: Item) => {
  const d = def(it.k);
  return Math.round(valOf(it) * (d.t === "part" ? E.partSell : (E.sellR?.[d.r] ?? E.sell)));
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

export function recycle(it: Item) {
  take(it);
  for (const [k, n] of Object.entries(recycleOf(it.k) || {}) as [ItemKey, number][]) for (let i = 0; i < n; i++) S.stash.push(mk(k));
}

/** Puts a piece on, sending what it replaces to the stash. */
export function wear(it: Item) {
  const s = slotOf(it);
  if (!s) return;
  const old = S.lo.eq[s];
  if (old) S.stash.push(old);
  S.lo.eq[s] = it;
}

/** Enough credits to buy the basic kit back after a death. */
export const RESERVE = () => price("p9") + price("vest1") + price("gen1") + 2 * price("med");
/** Can pay and still keep the reserve. */
export const affords = (c: Cost) => canPay({ ...c, cr: c.cr + RESERVE() });

function stock(): ItemKey[] {
  const maxR = E.stations.trade ? X.st.trade : 1;
  const pool = KEYS.filter((k) => wearable(k) && k !== FREE && def(k).r <= maxR);
  return Array.from({ length: E.stock }, () => pick(pool));
}

/** Buys the best pieces of today's stock that beat what is worn, with at most half of what lies above the reserve. */
export function shop(): number {
  const budget = (S.credits - RESERVE()) / 2;
  let spent = 0;
  for (const k of stock().sort((a, b) => def(b).v - def(a).v)) {
    const it = mk(k);
    if (!upgradeOver(it, S.lo.eq) || spent + price(k) > budget) continue;
    S.credits -= price(k);
    spent += price(k);
    wear(it);
  }
  return spent;
}

/** Crafts whatever unlocked recipe beats what is worn. */
export function craft(): number {
  let spent = 0;
  for (const r of E.recipes) {
    const it = mk(r.out);
    if (r.bench > X.st.bench || !upgradeOver(it, S.lo.eq) || !canPay(r.cost)) continue;
    pay(r.cost);
    spent += r.cost.cr;
    wear(it);
  }
  return spent;
}

const ORDER: StationKey[] = ["bench", "pocket", "trade"];

export function buildStations(): number {
  let spent = 0;
  for (const k of ORDER) {
    const lv = E.stations[k],
      c = lv?.[X.st[k]];
    if (!c || !affords(c)) continue;
    pay(c);
    spent += c.cr;
    X.st[k]++;
  }
  return spent;
}

/** Costs a player saves items for: next station levels and the recipes that would be an upgrade. */
export function stationNeeds(): Cost[] {
  const out: Cost[] = [];
  for (const k of ORDER) {
    const c = E.stations[k]?.[X.st[k]];
    if (c) out.push(c);
  }
  for (const r of E.recipes) if (r.bench <= X.st.bench + 1 && upgradeOver(mk(r.out), S.lo.eq)) out.push(r.cost);
  return out;
}

/** The pocket's places of a lost bag, most valuable first. */
export function pocketed(bag: Item[]): Item[] {
  const kept: Item[] = [];
  let room = X.st.pocket;
  for (const it of [...bag].sort((a, b) => valOf(b) - valOf(a)))
    if (def(it.k).s <= room) {
      kept.push(it);
      room -= def(it.k).s;
    }
  return kept;
}
