import { SHOP, def, emptyGear, mk, price, slotOf, upgradeOver, valOf, wearable, type Item, type ItemKey, type Slot } from "../src/items";
import { BENCH, KEY_MAX, MAX_LV, UP, applyRaid, canPay, medMax, norm, pay, qInfo, type Cost } from "../src/progression";
import { S, type Upgrades } from "../src/state";
import type { Profile, RaidOut } from "./raid";

// the stash screen's handlers (src/ui/stash.ts), played by a player who spends as soon as they can
const take = (it: Item) => S.stash.splice(S.stash.indexOf(it), 1);
const BENCHED: Slot[] = ["gun", "shield", "blade"];

export function endRaid(p: Profile, r: RaidOut) {
  S.st.raids++;
  if (!r.ok) {
    S.lo = { eq: emptyGear(), meds: 0, keys: 0 };
    S.st.dead++;
    return;
  }
  S.stash.push(...r.bag);
  S.lo.meds = Math.max(0, S.lo.meds - Math.round(p.meds + Math.random() - 0.5));
  S.lo.keys = r.keys;
  S.st.ext++;
  S.zx[r.zone]++;
  applyRaid(r.tally);
}

function claimAll(): number {
  let got = 0;
  for (const q of [...S.q]) {
    if (!qInfo(q).done) continue;
    if (q.t === "bring" && q.k) pay({ cr: 0, it: { [q.k]: q.n } });
    S.credits += q.cr;
    got += q.cr;
    if (q.rew) S.stash.push(mk(q.rew));
    S.q.splice(S.q.indexOf(q), 1);
  }
  norm();
  return got;
}

function equipBest() {
  for (const it of [...S.stash].sort((a, b) => valOf(b) - valOf(a))) {
    const s = slotOf(it);
    if (!s || !upgradeOver(it, S.lo.eq)) continue;
    take(it);
    const old = S.lo.eq[s];
    if (old) S.stash.push(old);
    S.lo.eq[s] = it;
  }
}

/** How many of each item a contract or the next upgrade asks for, as the stash screen flags them. */
export function needed(): Map<ItemKey, number> {
  const n = new Map<ItemKey, number>();
  const add = (c: Cost) => {
    for (const [k, m] of Object.entries(c.it) as [ItemKey, number][]) n.set(k, (n.get(k) || 0) + m);
  };
  for (const q of S.q) if (q.t === "bring" && q.k) add({ cr: 0, it: { [q.k]: q.n } });
  for (const k of Object.keys(UP) as (keyof Upgrades)[]) if (S.up[k] < MAX_LV) add(UP[k].cost[S.up[k]]);
  for (const s of BENCHED) {
    const w = S.lo.eq[s];
    if (w && (w.lv || 0) < MAX_LV) add(BENCH[w.lv || 0]);
  }
  return n;
}

function keep(it: Item, need: Map<ItemKey, number>, kept: Map<ItemKey, number>): boolean {
  const k = it.k,
    n = kept.get(k) || 0;
  const limit = { vkey: KEY_MAX, med: medMax() }[k as string] ?? need.get(k) ?? 0;
  kept.set(k, n + 1);
  return n < limit;
}

/** Sells everything but what a contract or upgrade needs, spare keys and medkits; returns the credits made. */
function sellSurplus(): number {
  const need = needed(),
    kept = new Map<ItemKey, number>();
  let got = 0;
  for (const it of [...S.stash]) {
    if (keep(it, need, kept)) continue;
    take(it);
    S.credits += valOf(it);
    got += valOf(it);
  }
  return got;
}

/** Buys the merchant's piece for each empty slot it sells, keeping enough for a medkit. */
function rebuy(): number {
  let spent = 0;
  for (const k of SHOP) {
    const s = slotOf(mk(k));
    if (!s || S.lo.eq[s] || S.credits < price(k) + price("med")) continue;
    S.credits -= price(k);
    spent += price(k);
    S.lo.eq[s] = mk(k);
  }
  return spent;
}

function upgrade(): number {
  let spent = 0;
  for (const k of ["bag", "hp", "meds"] as (keyof Upgrades)[]) {
    const c = UP[k].cost[S.up[k]];
    if (S.up[k] >= MAX_LV || !canPay(c)) continue;
    pay(c);
    spent += c.cr;
    S.up[k]++;
  }
  for (const s of BENCHED) {
    const w = S.lo.eq[s],
      c = w && BENCH[w.lv || 0];
    if (!w || !c || (w.lv || 0) >= MAX_LV || !canPay(c)) continue;
    pay(c);
    spent += c.cr;
    w.lv = (w.lv || 0) + 1;
  }
  return spent;
}

/** Medkits and keys into the loadout, buying medkits when the stash has none and credits allow. */
function packLoadout() {
  const meds = S.stash.filter((i) => i.k === "med");
  while (S.lo.meds < medMax() && (meds.length || S.credits >= price("med") * 4)) {
    const m = meds.pop();
    if (m) take(m);
    else S.credits -= price("med");
    S.lo.meds++;
  }
  for (const k of S.stash.filter((i) => i.k === "vkey")) {
    if (S.lo.keys >= KEY_MAX) break;
    take(k);
    S.lo.keys++;
  }
}

export interface Flow {
  sold: number;
  quests: number;
  spent: number;
  idle: boolean;
}

/** Everything a player does at the hideout between two raids; `idle` when nothing was left to buy. */
export function hideout(): Flow {
  const quests = claimAll();
  equipBest();
  const sold = sellSurplus();
  const spent = rebuy() + upgrade();
  packLoadout();
  const maxed = Object.values(S.up).every((l) => l >= MAX_LV) && BENCHED.every((s) => (S.lo.eq[s]?.lv || 0) >= MAX_LV);
  return { sold, quests, spent, idle: maxed };
}

export const gearValue = () => Object.values(S.lo.eq).reduce((s, it) => s + (it ? valOf(it) : 0), 0);
export const wornRarity = () => Object.values(S.lo.eq).reduce((s, it) => s + (it && wearable(it.k) ? def(it.k).r : 0), 0);
