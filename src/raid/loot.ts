import { KNIFE, RAR, bagUsed, def, gearStats, mk, slotOf, valOf, type Item, type Slot } from "../items";
import { MILITARY_ATT, MILITARY_SHIELDS, ROOM_SHIELDS, rollItem } from "../world/mapgen";
import { cap, maxHp } from "../progression";
import { C } from "../render/canvas";
import { toast, updHud } from "../ui/hud";
import { pick, rnd } from "../util";
import { nearestInReach } from "../world/geometry";
import { makeNav } from "../world/nav";
import { CORE } from "../world/rings";
import { R, burst, say } from "./core";
import { UNLOCK_TIME, crateTime, hasKey, lockCentre, type Crate, type Player, type Raid, type Vault } from "./model";
import { wornShield } from "./shield";

/** Heals over time from one medical item; false when it can't be used right now. */
function applyMed(r: Raid, it: Item): boolean {
  const p = r.p,
    d = def(it.k);
  if (d.t !== "med") return false;
  if (p.hp >= p.max) {
    toast("PV déjà au maximum");
    return false;
  }
  if (p.regen > 0) {
    toast("Soin déjà en cours");
    return false;
  }
  p.regen = d.heal;
  p.regenRate = d.heal / d.dur;
  burst(r, p, C.ok, { n: 10, sp: 90 });
  return true;
}

/** The heal button: carried medkits first, then whatever medical item is in the bag. */
export function heal() {
  const r = R;
  if (!r || r.dead > 0) return;
  const i = r.bag.findIndex((x) => def(x.k).t === "med");
  if (r.p.meds > 0) {
    if (applyMed(r, mk("med"))) r.p.meds--;
  } else if (i < 0) toast("Aucun soin");
  else if (applyMed(r, r.bag[i])) r.bag.splice(i, 1);
  updHud(r);
}

/** Loot lying within reach, best first: listed in the bag screen and labelled on the map. */
export const GROUND_R = 70;
export const ground = (r: Raid) =>
  r.pick
    .filter((k) => Math.hypot(k.x - r.p.x, k.y - r.p.y) < GROUND_R)
    .sort((a, b) => def(b.it.k).r - def(a.it.k).r || valOf(b.it) - valOf(a.it));

/** Drops an item at the player's feet; it is not picked up again until the player walks away. */
export const drop = (r: Raid, it: Item) => r.pick.push({ x: r.p.x + rnd(-14, 14), y: r.p.y + rnd(-14, 14), it, nop: true });

/** Bag places this raid: the hideout upgrade plus whatever backpack is worn. */
export const rcap = (r: Raid) => cap() + r.p.st.cap;
export const bladeOf = (p: Player) => p.eq.blade || KNIFE;

/** Puts a piece in its slot (or empties the slot with null) and returns what it replaced. */
export function setSlot(r: Raid, slot: Slot, it: Item | null): Item | null {
  const p = r.p,
    old = p.eq[slot],
    hp0 = p.max;
  p.eq[slot] = it;
  p.st = gearStats(p.eq);
  p.max = maxHp() + p.st.hp;
  p.hp = Math.min(p.max, p.hp + Math.max(0, p.max - hp0));
  if (slot === "shield") p.sh = wornShield(it, false);
  updHud(r);
  return old;
}
export function equip(r: Raid, it: Item) {
  const slot = slotOf(it);
  if (!slot) throw new Error(`${it.k} cannot be worn`);
  return setSlot(r, slot, it);
}

/** "Utiliser" from the bag: medical items and stimulants. */
export function useItem(it: Item) {
  const r = R;
  if (!r) return;
  const d = def(it.k);
  let used = false;
  if (d.t === "med") used = applyMed(r, it);
  if (d.t === "stim") {
    r.p.boost = d.dur;
    used = true;
  }
  if (used) r.bag.splice(r.bag.indexOf(it), 1);
  updHud(r);
}

function useKey(r: Raid) {
  if (r.p.keys > 0) r.p.keys--;
  else
    r.bag.splice(
      r.bag.findIndex((i) => i.k === "vkey"),
      1,
    );
}

function unlockVault(r: Raid, v: Vault) {
  useKey(r);
  v.open = true;
  r.walls = r.walls.filter((w) => !v.locks.includes(w));
  r.nav = makeNav(r.walls);
  r.fields.clear();
  r.flowT = 0;
  r.tally.vaults++;
  for (const l of v.locks) burst(r, lockCentre(l), "#f0c040", { n: 14, sp: 120, glow: true });
  toast("Salle forte ouverte");
  updHud(r);
}

/** Military crates are kept for the Cœur, where most indoor crates are one. */
export const indoorTier = (ring: number): Crate["tier"] => (ring === CORE && Math.random() < 0.6 ? 2 : 1);

function crateLoot(c: Crate): Item[] {
  const n = (base: number) => base + (Math.random() < 0.5 ? 1 : 0);
  if (c.vault)
    return Array.from({ length: 3 }, () => {
      let it = rollItem(c.d, { minR: 2 });
      while (it.k === "med") it = rollItem(1, { minR: 2 });
      return it;
    });
  if (c.tier === 0) return [Math.random() < 0.3 ? mk(pick(["bandage", "bandage", "med"] as const)) : rollItem(c.d * 0.4)];
  if (c.tier === 1) return Array.from({ length: n(1) }, () => rollItem(c.d, { shield: ROOM_SHIELDS }));
  return Array.from({ length: n(2) }, () => rollItem(c.d, { minR: 1, kit: true, shield: MILITARY_SHIELDS, att: MILITARY_ATT }));
}

function openCrate(r: Raid, c: Crate) {
  c.open = true;
  if (c.tier === 2 && !c.vault) r.tally.violet++;
  for (const it of crateLoot(c)) {
    const a = rnd(0, 6.28);
    r.pick.push({ x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 24, it });
  }
  if (c.tier > 0 && !c.vault && Math.random() < 0.07 + 0.05 * c.d) r.pick.push({ x: c.x, y: c.y + 26, it: mk("vkey") });
  burst(r, c, c.vault ? "#f0c040" : C.accent, { n: 10, sp: 80 });
}

function searchCrates(r: Raid, idle: boolean, dt: number) {
  const near = nearestInReach(r.crates, r.p, 48);
  for (const c of r.crates) {
    if (c.open) continue;
    c.prog = c === near && idle ? c.prog + dt / (1 - r.p.st.search) : 0;
    if (c.prog >= crateTime(c)) openCrate(r, c);
  }
  return near;
}

function pickLock(r: Raid, v: Vault, idle: boolean, dt: number) {
  const p = r.p,
    atLock = v.locks.some((l) => Math.hypot(lockCentre(l).x - p.x, lockCentre(l).y - p.y) < 64);
  if (atLock && !hasKey(r)) say(r, "Salle forte : il faut une clé");
  v.prog = atLock && idle && hasKey(r) ? v.prog + dt : 0;
  if (v.prog >= UNLOCK_TIME) unlockVault(r, v);
}

/** Opens the nearest crate and the vault while the player stands still at them; true while the hands are busy, so no shooting. */
export function search(r: Raid, idle: boolean, dt: number): boolean {
  const near = searchCrates(r, idle, dt),
    v = r.vault;
  if (v && !v.open) pickLock(r, v, idle, dt);
  return !!((near && !near.open && near.prog > 0) || (v && !v.open && v.prog > 0));
}

export function pickUp(r: Raid) {
  const p = r.p;
  for (let i = r.pick.length - 1; i >= 0; i--) {
    const k = r.pick[i],
      d = Math.hypot(k.x - p.x, k.y - p.y);
    if (k.nop) {
      if (d > 52) k.nop = false;
      continue;
    }
    if (d >= 26) continue;
    const it = def(k.it.k);
    if (bagUsed(r.bag) + it.s > rcap(r)) {
      say(r, "Sac plein : ouvre le sac pour échanger");
      continue;
    }
    r.bag.push(k.it);
    r.pick.splice(i, 1);
    toast(it.r >= 2 ? `${RAR[it.r]} : ${it.n}` : `+ ${it.n}`);
    updHud(r);
  }
}
