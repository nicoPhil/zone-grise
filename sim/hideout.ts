import { SHOP, def, emptyGear, mk, price, slotOf, upgradeOver, valOf, type Item, type ItemKey, type Slot } from "../src/items";
import { KEY_MAX, MAX_LV, UP, applyRaid, medMax, norm, pay, qInfo, type Cost } from "../src/progression";
import { S, type Upgrades } from "../src/state";
import { E, X, benchCap, benchCost } from "./econ";
import { affords, buildStations, craft, pocketed, recycle, recycleOf, saleOf, shop, stationNeeds, take, wear } from "./market";
import type { Profile, RaidOut } from "./raid";

// the stash screen's handlers (src/ui/stash.ts), played by a player who spends as soon as they can
const BENCHED: Slot[] = ["gun", "shield", "blade"];

export function endRaid(p: Profile, r: RaidOut) {
  S.st.raids++;
  if (!r.ok) {
    S.stash.push(...pocketed(r.bag));
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
    const cr = Math.round(q.cr * (1 + E.questZone * S.zone));
    S.credits += cr;
    got += cr;
    if (q.rew) S.stash.push(mk(q.rew));
    S.q.splice(S.q.indexOf(q), 1);
  }
  norm();
  return got;
}

function equipBest() {
  for (const it of [...S.stash].sort((a, b) => valOf(b) - valOf(a))) {
    if (!slotOf(it) || !upgradeOver(it, S.lo.eq)) continue;
    take(it);
    wear(it);
  }
}

const benchNext = (w: Item | null) => (w && (w.lv || 0) < Math.min(MAX_LV, benchCap()) ? benchCost(w.lv || 0, def(w.k).r) : null);

/** How many of each item a contract, the next upgrade or the next station level asks for. */
export function needed(): Map<ItemKey, number> {
  const n = new Map<ItemKey, number>();
  const add = (c: Cost) => {
    for (const [k, m] of Object.entries(c.it) as [ItemKey, number][]) n.set(k, (n.get(k) || 0) + m);
  };
  for (const q of S.q) if (q.t === "bring" && q.k) add({ cr: 0, it: { [q.k]: q.n } });
  for (const k of Object.keys(UP) as (keyof Upgrades)[]) if (S.up[k] < MAX_LV) add(UP[k].cost[S.up[k]]);
  for (const s of BENCHED) {
    const c = benchNext(S.lo.eq[s]);
    if (c) add(c);
  }
  for (const c of stationNeeds()) add(c);
  return n;
}

function keep(it: Item, need: Map<ItemKey, number>, kept: Map<ItemKey, number>): boolean {
  const k = it.k,
    n = kept.get(k) || 0;
  const limit = { vkey: KEY_MAX, med: medMax() }[k as string] ?? need.get(k) ?? 0;
  kept.set(k, n + 1);
  return n < limit;
}

/** Recycles what yields a missing material, sells the rest, keeping what is needed; returns the credits made. */
function sellSurplus(): number {
  const need = needed(),
    kept = new Map<ItemKey, number>();
  const lack = new Map(need);
  for (const it of S.stash) lack.set(it.k, (lack.get(it.k) || 0) - 1);
  const lacks = (k: ItemKey) => Object.keys(recycleOf(k) || {}).some((m) => (lack.get(m as ItemKey) || 0) > 0);
  let got = 0;
  for (const it of [...S.stash]) {
    if (keep(it, need, kept)) continue;
    if (E.recycle && lacks(it.k)) {
      recycle(it);
      continue;
    }
    take(it);
    S.credits += saleOf(it);
    got += saleOf(it);
  }
  return got;
}

/** Buys the merchant's piece for each empty slot it sells, keeping enough for a medkit. */
function rebuy(): number {
  if (E.freeKit && !S.lo.eq.gun && S.credits < price("p9")) S.lo.eq.gun = mk("p9");
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

function payFor(c: Cost): number {
  pay(c);
  return c.cr;
}

function upgrade(): number {
  let spent = 0;
  for (const k of ["bag", "hp", "meds"] as (keyof Upgrades)[]) {
    const c = UP[k].cost[S.up[k]];
    if (S.up[k] >= MAX_LV || !affords(c)) continue;
    spent += payFor(c);
    S.up[k]++;
  }
  for (const s of BENCHED) {
    const w = S.lo.eq[s],
      c = benchNext(w);
    if (!w || !c || !affords(c)) continue;
    spent += payFor(c);
    w.lv = (w.lv || 0) + 1;
  }
  return spent;
}

/** Medkits and keys into the loadout, buying medkits when the stash has none and credits allow. */
function packLoadout(): number {
  const meds = S.stash.filter((i) => i.k === "med");
  let spent = 0;
  while (S.lo.meds < medMax() && (meds.length || S.credits >= price("med") * 4)) {
    const m = meds.pop();
    if (m) take(m);
    else {
      S.credits -= price("med");
      spent += price("med");
    }
    S.lo.meds++;
  }
  for (const k of S.stash.filter((i) => i.k === "vkey")) {
    if (S.lo.keys >= KEY_MAX) break;
    take(k);
    S.lo.keys++;
  }
  return spent;
}

export interface Flow {
  sold: number;
  quests: number;
  spent: number;
  /** credits spent on: basic kit, upgrades and bench, stations, crafts, merchant pieces, medkits */
  by: number[];
  /** everything there is to build is built */
  done: boolean;
}

const allBuilt = () =>
  Object.values(S.up).every((l) => l >= MAX_LV) &&
  Object.entries(E.stations).every(([k, lv]) => X.st[k as keyof typeof X.st] >= (lv?.length || 0));

/** Everything a player does at the hideout between two raids. */
export function hideout(): Flow {
  const quests = claimAll();
  equipBest();
  const sold = sellSurplus();
  const by = [rebuy(), upgrade(), buildStations(), craft(), shop(), packLoadout()];
  return { sold, quests, spent: by.reduce((a, b) => a + b, 0), by, done: allBuilt() };
}

export const gearValue = () => Object.values(S.lo.eq).reduce((s, it) => s + (it ? valOf(it) : 0), 0);
