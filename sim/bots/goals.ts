import { bagUsed, def, valOf, type Item } from "../../src/items";
import { CALL_TIME, drop, hasKey, lockCentre, rcap, type Raid } from "../../src/raid";
import type { Pt } from "../../src/util";
import { ringOf } from "../../src/world/rings";
import type { Reach } from "./path";

/** How a bot plays: the knobs the comparison between bots turns. */
export interface Style {
  name: string;
  /** deepest ring it loots in: 0 Périphérie, 1 Zone chaude, 2 Cœur */
  ring: number;
  /** heads out once the bag is this full, or HP is below this share with no heal left */
  bag: number;
  hp: number;
  /** stands still to shoot what hunts it; otherwise keeps walking */
  fights: boolean;
  /** walks up to enemies to kill them for their components */
  hunts: boolean;
  /** seconds of slack kept on top of the walk out and the call */
  margin: number;
}

export const STYLES: Style[] = [
  { name: "Prudent", ring: 0, bag: 0.6, hp: 0.6, fights: true, hunts: false, margin: 25 },
  { name: "Équilibré", ring: 1, bag: 0.85, hp: 0.4, fights: true, hunts: false, margin: 15 },
  { name: "Gourmand", ring: 2, bag: 1, hp: 0.3, fights: true, hunts: false, margin: 8 },
  { name: "Pacifiste", ring: 1, bag: 0.85, hp: 0.4, fights: false, hunts: false, margin: 15 },
  { name: "Chasseur", ring: 1, bag: 0.85, hp: 0.4, fights: true, hunts: true, margin: 15 },
];

export type Kind = "crate" | "pick" | "lock" | "enemy" | "exit" | "hold";
export interface Goal {
  kind: Kind;
  /** live position: an enemy's goal follows it */
  at: Pt;
  ref: object;
}
export type Leave = "sac" | "PV" | "temps" | "plus rien";

const fits = (r: Raid, it: Item) => bagUsed(r.bag) + def(it.k).s <= rcap(r);
const perPlace = (it: Item) => valOf(it) / def(it.k).s;
export const canHeal = (r: Raid) => r.p.meds > 0 || r.bag.some((i) => def(i.k).t === "med");

/** Bag items worth less per place than `it`, cheapest first, enough to make room for it; null if there aren't. */
function swapFor(r: Raid, it: Item): Item[] | null {
  const need = bagUsed(r.bag) + def(it.k).s - rcap(r),
    out: Item[] = [];
  let freed = 0;
  for (const b of [...r.bag].sort((x, y) => perPlace(x) - perPlace(y))) {
    if (freed >= need) break;
    if (perPlace(b) > perPlace(it) * 0.7 || def(b.k).t === "key") return null;
    out.push(b);
    freed += def(b.k).s;
  }
  return freed >= need ? out : null;
}

/** Drops cheaper items to take `it`; false if it still doesn't fit. */
export function makeRoom(r: Raid, it: Item): boolean {
  if (fits(r, it)) return true;
  const out = swapFor(r, it);
  if (!out) return false;
  for (const b of out) {
    r.bag.splice(r.bag.indexOf(b), 1);
    drop(r, b);
  }
  return true;
}

export function nearestExit(r: Raid, reach: Reach): { at: Pt; d: number } | null {
  let best: { at: Pt; d: number } | null = null;
  for (const e of r.exits) {
    const d = reach.to(e);
    if (d >= 0 && (!best || d < best.d)) best = { at: e, d };
  }
  return best;
}

export function leaveReason(r: Raid, s: Style, reach: Reach): Leave | null {
  const p = r.p;
  if (bagUsed(r.bag) >= rcap(r) * s.bag) return "sac";
  if (p.hp < p.max * s.hp && !canHeal(r)) return "PV";
  const out = nearestExit(r, reach);
  const walk = out ? (out.d / (175 * (1 + p.st.spd))) * 1.25 : 0;
  if (r.t < walk + CALL_TIME * (1 - p.st.call) + s.margin) return "temps";
  return null;
}

/** Loot on the ground close by that fits, or is worth dropping cheaper things for. */
export function pickGoal(r: Raid, reach: Reach, skip: Set<object>): Goal | null {
  let best: Goal | null = null,
    bd = 220;
  for (const k of r.pick) {
    if (k.nop || skip.has(k) || (!fits(r, k.it) && !swapFor(r, k.it))) continue;
    const d = reach.to(k);
    if (d >= 0 && d < bd) [best, bd] = [{ kind: "pick", at: k, ref: k }, d];
  }
  return best;
}

const CRATE_W = [1, 3, 7];

/** The unopened crate with the best worth for the walk, in the rings the bot goes to. */
export function crateGoal(r: Raid, s: Style, reach: Reach, skip: Set<object>): Goal | null {
  let best: Goal | null = null,
    bs = 0;
  for (const c of r.crates) {
    if (c.open || skip.has(c) || ringOf(c.x, c.y) > s.ring) continue;
    const d = reach.to(c),
      score = (c.vault ? 12 : CRATE_W[c.tier]) / (d + 300);
    if (d >= 0 && score > bs) [best, bs] = [{ kind: "crate", at: c, ref: c }, score];
  }
  return best;
}

export function lockGoal(r: Raid, s: Style): Goal | null {
  const v = r.vault;
  if (!v || v.open || !hasKey(r)) return null;
  const at = lockCentre(v.locks[0]);
  return ringOf(at.x, at.y) <= s.ring ? { kind: "lock", at, ref: v } : null;
}

export function huntGoal(r: Raid, s: Style, reach: Reach, skip: Set<object>): Goal | null {
  if (!s.hunts) return null;
  let best: Goal | null = null,
    bd = 700;
  for (const e of r.enemies) {
    if (skip.has(e) || ringOf(e.x, e.y) > s.ring) continue;
    const d = reach.to(e);
    if (d >= 0 && d < bd) [best, bd] = [{ kind: "enemy", at: e, ref: e }, d];
  }
  return best;
}
