import {
  FREE,
  KNIFE,
  RAR,
  bagUsed,
  def,
  emptyGear,
  gearStats,
  mk,
  slotOf,
  valOf,
  wstat,
  type Gear,
  type Item,
  type Mods,
  type Slot,
  type WeaponStats,
} from "./items";
import { applyRaid, cap, maxHp, type RaidTally } from "./progression";
import { C } from "./render/canvas";
import { furnish } from "./render/furniture";
import { THEMES, blood, makeDecal, makeDecor, makeGround, stampCasing, type Decal, type Decor } from "./render/decor";
import type { Tile } from "./render/assets";
import { S, mode, save, setMode } from "./state";
import { clearStick, moveVec, prefs } from "./input";
import { CONE_HALF, WAVE_SEARCH, alert, hear, inCone, suspicious, track, watch, type Awareness } from "./aware";
import { setRaidHud, showHint, toast, updHud } from "./ui/hud";
import { closeBag } from "./ui/bag";
import { renderEnd } from "./ui/end";
import { clamp, pick, rnd, type Pt, type Rect } from "./util";
import { MELEE_ARC, collide, frontHit, inArc, inWall, los, nearestInReach } from "./world/geometry";
import { depth, freePt, genMap, placeEntries, rollItem, type Building } from "./world/mapgen";
import { cellOf, flowDir, makeNav, updFlow, type Nav } from "./world/nav";
import { pickVault } from "./world/vault";
import { ZONES, UNLOCK_AFTER, power, unlocked, zoneDepth, type Zone } from "./zones";

export type Kind = "walker" | "runner" | "gunner" | "boss" | "smg" | "bloat" | "sniper" | "shield" | "stalker" | "alpha";
interface KindStats {
  hp: number;
  spd: number;
  r: number;
  melee: number;
  hitCd: number;
  see: number;
}
/** `see` is the length of the view cone: shorter than half the phone screen, so the player sees first. */
export const KINDS: Record<Kind, KindStats> = {
  walker: { hp: 42, spd: 118, r: 14, melee: 15, hitCd: 0.8, see: 190 },
  runner: { hp: 22, spd: 160, r: 11, melee: 9, hitCd: 0.55, see: 210 },
  gunner: { hp: 55, spd: 85, r: 14, melee: 0, hitCd: 0, see: 220 },
  boss: { hp: 650, spd: 62, r: 22, melee: 25, hitCd: 1, see: 230 },
  smg: { hp: 55, spd: 90, r: 14, melee: 0, hitCd: 0, see: 220 },
  bloat: { hp: 70, spd: 72, r: 17, melee: 0, hitCd: 0, see: 180 },
  sniper: { hp: 40, spd: 75, r: 14, melee: 0, hitCd: 0, see: 420 },
  shield: { hp: 95, spd: 80, r: 15, melee: 18, hitCd: 0.9, see: 200 },
  stalker: { hp: 48, spd: 270, r: 12, melee: 22, hitCd: 0.7, see: 230 },
  alpha: { hp: 130, spd: 150, r: 15, melee: 16, hitCd: 0.7, see: 230 },
};
/** Bloater blast; sniper aim before the shot; how close the stalker creeps before charging; reach of the pack leader's howl. */
export const BLAST_R = 95,
  AIM_TIME = 1.1,
  LUNGE_R = 260,
  PACK_R = 280;
/** Damage multiplier of a blade on an enemy that hasn't spotted the player. */
export const SNEAK = 2.5;

export interface Enemy extends Pt, Awareness {
  kind: Kind;
  hp: number;
  max: number;
  wx: number;
  wy: number;
  /** facing, and the heading it turns towards */
  fa: number;
  ta: number;
  wt: number;
  cd: number;
  hit: number;
  /** behaviour phase: bloater fuse lit, sniper aiming, stalker charging */
  ph: number;
  /** time spent in the current phase */
  t: number;
}
export interface Crate extends Pt {
  d: number;
  open: boolean;
  prog: number;
  vault?: boolean;
}
export interface Bullet extends Pt {
  vx: number;
  vy: number;
  life: number;
  dmg: number;
}
export interface Pickup extends Pt {
  it: Item;
  nop?: boolean;
}
export interface Particle extends Pt {
  vx: number;
  vy: number;
  life: number;
  col: string;
  glow: boolean;
}
export interface Casing extends Pt {
  vx: number;
  vy: number;
  r: number;
  vr: number;
}
export interface Player extends Pt {
  hp: number;
  max: number;
  /** gun and blade cooldowns */
  cd: number;
  mcd: number;
  face: number;
  eq: Gear;
  /** bonuses from what is worn, refreshed on every equip */
  st: Required<Mods>;
  meds: number;
  keys: number;
  /** HP still to restore from the medkit in use, and how fast */
  regen: number;
  regenRate: number;
  /** seconds left on a stimulant */
  boost: number;
  /** melee swing animation, and how long the body keeps facing the last target */
  swing: number;
  faceLock: number;
  hit: number;
  still: number;
}
export interface Vault {
  room: Rect;
  locks: Rect[];
  open: boolean;
  prog: number;
}
export interface Raid {
  zi: number;
  zone: Zone;
  power0: number;
  walls: Rect[];
  bld: Building[];
  nav: Nav;
  ground: Tile[];
  decor: Decor[];
  decal: Decal;
  p: Player;
  exits: Pt[];
  vault: Vault | null;
  crates: Crate[];
  enemies: Enemy[];
  bullets: Bullet[];
  ebul: Bullet[];
  pick: Pickup[];
  parts: Particle[];
  cas: Casing[];
  /** flow fields towards searched spots, by grid cell */
  fields: Map<number, Int16Array>;
  /** floating damage numbers */
  nums: (Pt & { v: number; life: number; big: boolean })[];
  bag: Item[];
  t: number;
  spawnT: number;
  flowT: number;
  ext: number;
  toastT: number;
  shake: number;
  flash: number;
  tally: Omit<RaidTally, "haul">;
  /** seconds left of the death sequence before the end screen, and why the raid is lost */
  dead: number;
  why: string;
}

export const DEATH_TIME = 1.8,
  RAID_TIME = 240,
  CRATE_TIME = 0.8,
  EXTRACT_TIME = 3,
  UNLOCK_TIME = 1.2,
  VIOLET = 0.62;
export let R: Raid | null = null;
export const clock = { last: performance.now() };

export const hasKey = (r: Raid) => r.p.keys > 0 || r.bag.some((i) => i.k === "vkey");
export const lockCentre = (l: Rect): Pt => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });

/** A wave enemy is lured towards where the player was when it appeared. */
function spawn(r: Raid, kind: Kind, x: number, y: number, lure?: Pt) {
  const hp = Math.round(KINDS[kind].hp * r.zone.hp),
    fa = rnd(0, 6.28);
  const e: Enemy = {
    kind,
    x,
    y,
    hp,
    max: hp,
    aggro: false,
    lx: x,
    ly: y,
    lost: 0,
    sr: 0,
    al: 0,
    sus: 0,
    wx: 0,
    wy: 0,
    fa,
    ta: fa,
    wt: 0,
    cd: rnd(0.5, 1.5),
    hit: 0,
    ph: 0,
    t: 0,
  };
  if (lure) hear(e, lure.x, lure.y, WAVE_SEARCH);
  r.enemies.push(e);
}

/** View cone of an enemy; a searching one is on the lookout and sees further. */
export const sight = (e: Enemy, p: Player) => ({
  range: KINDS[e.kind].see * (e.sr > 0 ? 1.2 : 1) * (1 - p.st.quiet),
  half: e.kind === "sniper" ? 0.4 : CONE_HALF,
});

/** Walkers at the edge, runner packs further in, gunners near the centre; harder zones shift the mix inwards and add their own kinds. */
function spawnByZone(r: Raid, x: number, y: number, lure?: Pt) {
  const d = zoneDepth(r.zone, depth(x, y)),
    has = (k: Kind) => r.zone.adds.includes(k);
  const near = () => {
    const nx = x + rnd(-40, 40),
      ny = y + rnd(-40, 40);
    return inWall(r.walls, nx, ny, 14) ? { x, y } : { x: nx, y: ny };
  };
  const one = (k: Kind) => () => spawn(r, k, x, y, lure);
  const pack = (k: Kind, n: number, lead?: Kind) => () => {
    if (lead) spawn(r, lead, x, y, lure);
    for (let i = 0; i < n; i++) {
      const c = near();
      spawn(r, k, c.x, c.y, lure);
    }
  };
  const table: [number, () => void][] =
    d < 0.3
      ? [
          [85, one("walker")],
          [has("bloat") ? 15 : 0, one("bloat")],
        ]
      : d < 0.6
        ? [
            [40, pack("runner", Math.random() < 0.5 ? 2 : 3)],
            [45, one("walker")],
            [has("bloat") ? 15 : 0, one("bloat")],
            [has("alpha") ? 15 : 0, pack("runner", 3, "alpha")],
          ]
        : [
            [30, pack("gunner", Math.random() < 0.5 ? 0 : 1, "gunner")],
            [25, one("walker")],
            [has("bloat") ? 12 : 0, one("bloat")],
            [has("smg") ? 14 : 0, pack("gunner", Math.random() < 0.5 ? 0 : 1, "smg")],
            [has("sniper") ? 12 : 0, one("sniper")],
            [has("shield") ? 14 : 0, pack("gunner", Math.random() < 0.5 ? 0 : 1, "shield")],
            [has("stalker") ? 12 : 0, pack("stalker", Math.random() < 0.4 ? 1 : 0, "stalker")],
            [has("alpha") ? 12 : 0, pack("runner", 3, "alpha")],
          ];
  let roll = Math.random() * table.reduce((s, [w]) => s + w, 0);
  for (const [w, go] of table) {
    roll -= w;
    if (roll < 0) return go();
  }
}

function randIn(walls: Rect[], rm: Rect, pad: number): Pt | null {
  for (let t = 0; t < 60; t++) {
    const x = rnd(rm.x + pad, rm.x + rm.w - pad),
      y = rnd(rm.y + pad, rm.y + rm.h - pad);
    if (!inWall(walls, x, y, pad)) return { x, y };
  }
  return null;
}

export function startRaid() {
  const zi = unlocked(S, S.zone) ? S.zone : 0,
    zone = ZONES[zi];
  const { walls, bld } = genMap();
  const plan = zone.vault ? pickVault(walls, bld) : null;
  if (plan) walls.push(...plan.locks);
  const { sp, exits } = placeEntries(walls, bld, plan && { x: plan.room.x + plan.room.w / 2, y: plan.room.y + plan.room.h / 2 });
  const st = gearStats(S.lo.eq);
  const r: Raid = {
    zi,
    zone,
    power0: power(),
    walls,
    bld,
    nav: makeNav(walls),
    ground: makeGround(THEMES[zi]),
    decor: [...furnish(bld, THEMES[zi].fit, THEMES[zi].mess), ...makeDecor(walls, bld, THEMES[zi])],
    decal: makeDecal(THEMES[zi]),
    p: {
      x: sp.x,
      y: sp.y,
      hp: maxHp() + st.hp,
      max: maxHp() + st.hp,
      cd: 0,
      mcd: 0,
      face: 0,
      eq: { ...S.lo.eq },
      st,
      meds: S.lo.meds,
      keys: S.lo.keys,
      regen: 0,
      regenRate: 0,
      boost: 0,
      swing: 0,
      faceLock: 0,
      hit: 0,
      still: 0,
    },
    exits,
    vault: plan && { room: plan.room, locks: plan.locks, open: false, prog: 0 },
    crates: [],
    enemies: [],
    bullets: [],
    ebul: [],
    pick: [],
    parts: [],
    cas: [],
    fields: new Map(),
    nums: [],
    bag: [],
    t: RAID_TIME,
    spawnT: zone.wave,
    flowT: 0,
    ext: 0,
    toastT: 0,
    shake: 0,
    flash: 0,
    tally: { kills: 0, violet: 0, vaults: 0, boss: 0 },
    dead: 0,
    why: "",
  };
  const rooms = bld.flatMap((b) => b.rooms).filter((rm) => rm !== plan?.room);
  const far = (c: Pt | null, m: number): c is Pt => !!c && Math.hypot(c.x - sp.x, c.y - sp.y) > m;
  const inRoom = (pad: number) => (rooms.length ? randIn(walls, pick(rooms), pad) : null);
  for (let i = 0; i < 18; i++) {
    let c = Math.random() < 0.75 ? inRoom(30) : null;
    if (!far(c, 200)) c = freePt(walls, 30, (x, y) => Math.hypot(x - sp.x, y - sp.y) > 260);
    r.crates.push({ x: c.x, y: c.y, d: zoneDepth(zone, depth(c.x, c.y)), open: false, prog: 0 });
  }
  for (let i = 0; i < zone.enemies; i++) {
    let c = Math.random() < 0.5 ? inRoom(24) : null;
    if (!far(c, 480)) c = freePt(walls, 24, (x, y) => Math.hypot(x - sp.x, y - sp.y) > 480);
    spawnByZone(r, c.x, c.y);
  }
  if (plan) {
    for (let i = 0; i < 2; i++) {
      const c = randIn(walls, plan.room, 30);
      if (c) r.crates.push({ ...c, d: 1, open: false, prog: 0, vault: true });
    }
    // the vault's guards wait in its building, outside the locked room: the Brute in the Cœur, two gunners elsewhere
    const guardRooms = plan.b.rooms.filter((rm) => rm !== plan.room);
    const guardAt = () =>
      (guardRooms.length && randIn(walls, pick(guardRooms), 26)) ||
      freePt(walls, 26, (x, y) => Math.hypot(x - plan.room.x, y - plan.room.y) < 400);
    if (zone.boss) {
      const g = guardAt();
      spawn(r, "boss", g.x, g.y);
    } else
      for (let i = 0; i < 2; i++) {
        const g = guardAt();
        spawn(r, "gunner", g.x, g.y);
      }
  }
  R = r;
  S.st.raids++;
  save();
  setMode("raid");
  clearStick();
  setRaidHud(true);
  showHint(!r.p.eq.gun);
  updHud(r);
  clock.last = performance.now();
}

function burst(r: Raid, x: number, y: number, col: string, n = 8, sp = 140, glow = false) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28),
      s = rnd(30, sp);
    r.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.2, 0.5), col, glow });
  }
}
const noise = (r: Raid, x: number, y: number, rad: number) => {
  // walls muffle: through them a noise carries half as far
  for (const e of r.enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < rad / 2 || (d < rad && los(r.walls, e, { x, y }))) hear(e, x, y);
  }
};

/** The raid has ended (death or extraction) during this frame; sorting the bag still counts as in the raid. */
const over = () => mode !== "raid" && mode !== "bag";

/** The raid is lost: a slow-motion death sequence plays before the end screen. */
function die(r: Raid, why: string) {
  if (r.dead > 0) return;
  [r.dead, r.why, r.shake] = [DEATH_TIME, why, 0.5];
  if (mode === "bag") closeBag();
  clearStick();
}

function hurt(r: Raid, d: number) {
  if (over() || r.dead > 0) return;
  const p = r.p;
  d *= r.zone.dmg;
  p.hp -= d * (1 - p.st.red);
  p.hit = 0.15;
  r.shake = 0.12 + 0.004 * d;
  if (p.hp <= 0) die(r, "Tu es mort.");
}

function say(r: Raid, msg: string) {
  if (r.toastT > 0) return;
  toast(msg);
  r.toastT = 2.5;
}

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
  burst(r, p.x, p.y, C.ok, 10, 90);
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

/** "Utiliser" from the bag: medical items and stimulants. */
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
  updHud(r);
  return old;
}
export const equip = (r: Raid, it: Item) => setSlot(r, slotOf(it)!, it);

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
  for (const l of v.locks) burst(r, lockCentre(l).x, lockCentre(l).y, "#f0c040", 14, 120, true);
  toast("Salle forte ouverte");
  updHud(r);
}

function openCrate(r: Raid, c: Crate) {
  c.open = true;
  if (c.d > VIOLET) r.tally.violet++;
  const n = c.vault ? 3 : 1 + Math.floor(Math.random() * 2) + (c.d > 0.55 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    let it = rollItem(c.d, c.vault ? 2 : 0);
    while (c.vault && it.k === "med") it = rollItem(1, 2);
    const a = rnd(0, 6.28);
    r.pick.push({ x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 24, it });
  }
  if (!c.vault && Math.random() < 0.07 + 0.05 * c.d) r.pick.push({ x: c.x, y: c.y + 26, it: mk("vkey") });
  burst(r, c.x, c.y, c.vault ? "#f0c040" : C.accent, 10, 80);
}

function blast(r: Raid, x: number, y: number) {
  const p = r.p;
  burst(r, x, y, "#a6d36a", 34, 260);
  burst(r, x, y, "#f2a33a", 16, 200, true);
  r.shake = Math.max(r.shake, 0.3);
  noise(r, x, y, 320);
  if (Math.hypot(p.x - x, p.y - y) < BLAST_R) hurt(r, 24);
  for (const o of [...r.enemies])
    if (r.enemies.includes(o) && Math.hypot(o.x - x, o.y - y) < BLAST_R) hitEnemy(r, o, 60, o.x, o.y, true, "blast");
}

function killed(r: Raid, e: Enemy) {
  if (!r.enemies.includes(e)) return;
  r.enemies.splice(r.enemies.indexOf(e), 1);
  r.tally.kills++;
  burst(r, e.x, e.y, C.bad, e.kind === "boss" ? 40 : 14, 160);
  blood(r.decal, e.x, e.y, e.kind === "boss" ? 30 : 14, true);
  const drop = (it: Item) => {
    const a = rnd(0, 6.28);
    r.pick.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, it });
  };
  if (e.kind === "boss") {
    r.tally.boss++;
    drop(mk("vkey"));
    drop(rollItem(1, 2));
    drop(rollItem(1, 2));
    toast("La Brute est tombée");
    return;
  }
  if (e.kind === "bloat") return blast(r, e.x, e.y);
  const elite = e.kind === "smg" || e.kind === "sniper" || e.kind === "shield" || e.kind === "alpha";
  if ((e.kind === "gunner" || elite) && Math.random() < 0.2) drop(mk("vkey"));
  if (Math.random() < (elite ? 0.75 : 0.45)) drop(rollItem(zoneDepth(r.zone, depth(e.x, e.y)) + (elite ? 0.1 : 0)));
}

function hitEnemy(r: Raid, e: Enemy, dmg: number, x: number, y: number, big = false, by: "gun" | "blade" | "blast" = "gun") {
  // a blade the enemy never saw coming hits harder
  if (by === "blade" && !e.aggro) [dmg, big] = [Math.round(dmg * SNEAK), true];
  e.hp -= dmg;
  e.hit = big ? 0.16 : 0.1;
  r.nums.push({ x: e.x + rnd(-6, 6), y: e.y - 18, v: dmg, life: 0.7, big });
  if (by === "blast") hear(e, x, y);
  else alert(e, r.p.x, r.p.y);
  burst(r, x, y, C.bad, 4, 90);
  blood(r.decal, x, y, 3, false);
  if (e.hp <= 0) killed(r, e);
}

/** Swings at the nearest enemy in reach and hits everyone inside the arc in front. */
function strike(r: Raid, wd: WeaponStats) {
  const p = r.p,
    reach = (e: Enemy) => wd.range + KINDS[e.kind].r;
  let target: Enemy | null = null,
    bd = Infinity;
  for (const e of r.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < reach(e) && d < bd && los(r.walls, p, e)) {
      bd = d;
      target = e;
    }
  }
  if (!target) return;
  const a0 = Math.atan2(target.y - p.y, target.x - p.x);
  p.face = a0;
  p.faceLock = 0.25;
  p.mcd = 1 / wd.rate;
  p.swing = 0.18;
  for (const e of [...r.enemies]) {
    if (!inArc(p.x, p.y, a0, e.x, e.y, reach(e), MELEE_ARC)) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x),
      kb = (wd.kb || 0) * (e.kind === "boss" ? 0.2 : 1);
    e.x += Math.cos(a) * kb;
    e.y += Math.sin(a) * kb;
    collide(r.walls, e, KINDS[e.kind].r);
    hitEnemy(r, e, wd.dmg, e.x - Math.cos(a) * 10, e.y - Math.sin(a) * 10, true, "blade");
    burst(r, e.x - Math.cos(a) * 12, e.y - Math.sin(a) * 12, "#f4efe4", 5, 120, true);
  }
  r.shake = Math.max(r.shake, 0.05);
  noise(r, p.x, p.y, wd.noise);
}

/** Direction to walk to a searched spot, around walls; null once there. */
function goTo(r: Raid, e: Enemy, x: number, y: number): Pt | null {
  const dx = x - e.x,
    dy = y - e.y,
    d = Math.hypot(dx, dy);
  if (d < 30) return null;
  if (los(r.walls, e, { x, y })) return { x: dx / d, y: dy / d };
  const c = cellOf(x, y);
  let f = r.fields.get(c);
  if (!f) {
    if (r.fields.size > 24) r.fields.clear();
    f = new Int16Array(r.nav.dist.length);
    updFlow(r.nav, x, y, f);
    r.fields.set(c, f);
  }
  return flowDir(r.nav, e.x, e.y, f) || { x: dx / d, y: dy / d };
}

/** Chase direction: straight at the player in sight, otherwise along the flow field around walls. */
function chase(r: Raid, e: Enemy, see: boolean, dx: number, dy: number, d: number): Pt {
  return (see ? null : flowDir(r.nav, e.x, e.y)) || { x: dx / d, y: dy / d };
}

function shoot(r: Raid, e: Enemy, a: number, n: number, spread: number, speed: number, dmg: number) {
  for (let i = 0; i < n; i++) {
    const b = a + (n > 1 ? -spread + (2 * spread * i) / (n - 1) : rnd(-spread, spread));
    r.ebul.push({ x: e.x, y: e.y, vx: Math.cos(b) * speed, vy: Math.sin(b) * speed, life: 1.6, dmg });
  }
}

function updateEnemy(r: Raid, e: Enemy, dt: number) {
  const p = r.p,
    k = KINDS[e.kind];
  const dx = p.x - e.x,
    dy = p.y - e.y,
    d = Math.hypot(dx, dy) || 1;
  e.cd -= dt;
  e.hit -= dt;
  const see = d < 600 && los(r.walls, e, p),
    { range, half } = sight(e, p);
  const view = !e.aggro && see && mode !== "bag" && inCone(e.fa, e, p, range, half);
  watch(e, view, d, range, p, dt);
  track(e, see, p, dt);
  let vx = 0,
    vy = 0;
  if (e.aggro) e.fa = e.ta = Math.atan2(dy, dx);
  if (!e.aggro) {
    e.wt -= dt;
    // a suspicious enemy stops and stares while it makes up its mind
    if (view) e.ta = Math.atan2(dy, dx);
    else if (e.sr > 0) {
      const g = goTo(r, e, e.lx, e.ly),
        v = Math.min(k.spd * 0.6, 110);
      if (g) [vx, vy, e.ta] = [g.x * v, g.y * v, Math.atan2(g.y, g.x)];
      else if (e.wt <= 0) [e.ta, e.wt] = [rnd(0, 6.28), rnd(0.8, 1.5)];
    } else {
      if (e.wt <= 0) {
        // guards, snipers and stalkers hold their spot and only look around
        const a = rnd(0, 6.28),
          still = e.kind === "boss" || e.kind === "stalker" || e.kind === "sniper" || Math.random() < 0.4;
        [e.wx, e.wy, e.ta, e.wt] = still ? [0, 0, a, rnd(1.5, 3.5)] : [Math.cos(a), Math.sin(a), a, rnd(1.5, 4)];
      }
      [vx, vy] = [e.wx * 40, e.wy * 40];
    }
    const da = Math.atan2(Math.sin(e.ta - e.fa), Math.cos(e.ta - e.fa));
    e.fa += clamp(da, -3 * dt, 3 * dt);
  } else if (e.kind === "bloat") {
    // once lit, the fuse burns out even if the player steps away
    if (!e.ph && d < k.r + 30) e.ph = 1;
    if (e.ph) {
      e.t += dt;
      if (e.t >= 0.6) return killed(r, e);
    } else {
      const g = chase(r, e, see, dx, dy, d);
      vx = g.x * k.spd;
      vy = g.y * k.spd;
    }
  } else if (e.kind === "sniper") {
    // stands still to aim; breaking the line of sight cancels the shot
    e.ph = see && d < 760 && e.cd <= 0 ? 1 : 0;
    e.t = e.ph ? e.t + dt : 0;
    if (e.t >= AIM_TIME) {
      shoot(r, e, Math.atan2(dy, dx), 1, 0, 950, 22);
      e.cd = rnd(1.6, 2.2);
      e.t = e.ph = 0;
    } else if (!e.ph && (!see || d > 760)) {
      const g = chase(r, e, see, dx, dy, d);
      vx = g.x * k.spd;
      vy = g.y * k.spd;
    } else if (!e.ph && d < 260) {
      vx = (-dx / d) * k.spd;
      vy = (-dy / d) * k.spd;
    }
  } else if (e.kind === "stalker") {
    // creeps up unseen, then charges for a short burst and rests
    e.t += dt;
    if (e.ph === 0 && see && d < LUNGE_R) [e.ph, e.t] = [1, 0];
    else if (e.ph === 1 && e.t > 1.4) [e.ph, e.t] = [2, 0];
    else if (e.ph === 2 && e.t > 1.1) [e.ph, e.t] = [0, 0];
    const g = chase(r, e, see, dx, dy, d),
      v = e.ph === 1 ? k.spd : e.ph === 2 ? 0 : 70;
    vx = g.x * v;
    vy = g.y * v;
    if (d < k.r + 16 && e.cd <= 0) {
      hurt(r, k.melee);
      e.cd = k.hitCd;
    }
  } else if (e.kind === "gunner" || e.kind === "smg") {
    if (!see || d > 320) {
      const g = chase(r, e, see, dx, dy, d);
      vx = g.x * k.spd;
      vy = g.y * k.spd;
    } else if (d < 190) {
      vx = (-dx / d) * 70;
      vy = (-dy / d) * 70;
    }
    if (see && d < 400 && e.cd <= 0 && e.kind === "gunner") {
      shoot(r, e, Math.atan2(dy, dx), 1, 0.06, 300, 12);
      e.cd = rnd(1.3, 1.8);
    } else if (see && d < 380 && e.cd <= 0) {
      // bursts of five quick, weaker and less accurate shots
      shoot(r, e, Math.atan2(dy, dx), 1, 0.14, 320, 5);
      e.ph = (e.ph + 1) % 5;
      e.cd = e.ph ? 0.11 : rnd(1.4, 1.9);
    }
  } else {
    if (e.kind !== "boss" || !see || d > 240) {
      // runners near a living pack leader run faster
      const howl = e.kind === "runner" && r.enemies.some((o) => o.kind === "alpha" && Math.hypot(o.x - e.x, o.y - e.y) < PACK_R) ? 1.35 : 1;
      const g = chase(r, e, see, dx, dy, d);
      vx = g.x * k.spd * howl;
      vy = g.y * k.spd * howl;
    }
    if (d < k.r + 16 && e.cd <= 0) {
      hurt(r, k.melee);
      e.cd = k.hitCd;
    } else if (e.kind === "boss" && see && d < 420 && e.cd <= 0) {
      shoot(r, e, Math.atan2(dy, dx), 5, 0.24, 260, 12);
      e.cd = 1.9;
    }
  }
  e.x += vx * dt;
  e.y += vy * dt;
  for (const o of r.enemies) {
    if (o === e) continue;
    const min = k.r + KINDS[o.kind].r,
      ox = e.x - o.x,
      oy = e.y - o.y,
      od = Math.hypot(ox, oy);
    if (od > 0 && od < min) {
      e.x += ((ox / od) * (min - od)) / 2;
      e.y += ((oy / od) * (min - od)) / 2;
    }
  }
  // enemies stop at the player's edge instead of standing on top of the sprite
  const px = e.x - p.x,
    py = e.y - p.y,
    pd = Math.hypot(px, py),
    touch = k.r + 11;
  if (pd < touch) {
    const ux = pd ? px / pd : Math.cos(e.wt),
      uy = pd ? py / pd : Math.sin(e.wt);
    e.x = p.x + ux * touch;
    e.y = p.y + uy * touch;
  }
  collide(r.walls, e, k.r);
}

export function update(dt: number) {
  const r = R;
  if (!r) return;
  if (r.dead > 0) {
    r.dead -= dt;
    if (r.dead <= 0) return endRaid(false, r.why);
    dt *= 0.25;
  }
  // the raid keeps running while the bag is open: the player stands still, doesn't fight and isn't spotted
  const sorting = mode === "bag" || r.dead > 0;
  const p = r.p,
    m = sorting ? { x: 0, y: 0 } : moveVec(),
    moving = m.x !== 0 || m.y !== 0;
  const spd = (p.boost > 0 ? 236 : 175) * (1 + p.st.spd);
  p.x += m.x * spd * dt;
  p.y += m.y * spd * dt;
  collide(r.walls, p, 13);
  p.boost -= dt;
  p.swing -= dt;
  p.faceLock -= dt;
  if (moving && p.faceLock <= 0) p.face = Math.atan2(m.y, m.x);
  p.still = moving ? 0 : p.still + dt;
  p.cd -= dt;
  p.mcd -= dt;
  p.hit -= dt;
  r.shake -= dt;
  r.toastT -= dt;
  if (p.regen > 0) {
    const g = Math.min(p.regen, p.regenRate * dt);
    p.hp = Math.min(p.max, p.hp + g);
    p.regen = p.hp >= p.max ? 0 : p.regen - g;
  }

  const near = nearestInReach(r.crates, p, 48);
  for (const c of r.crates) {
    if (c.open) continue;
    c.prog = c === near && !moving && !sorting ? c.prog + dt : 0;
    if (c.prog >= CRATE_TIME) openCrate(r, c);
  }

  const v = r.vault;
  if (v && !v.open) {
    const atLock = v.locks.some((l) => Math.hypot(lockCentre(l).x - p.x, lockCentre(l).y - p.y) < 64);
    if (atLock && !hasKey(r)) say(r, "Salle forte : il faut une clé");
    v.prog = atLock && !moving && !sorting && hasKey(r) ? v.prog + dt : 0;
    if (v.prog >= UNLOCK_TIME) unlockVault(r, v);
  }
  // searching a crate or picking a lock keeps the hands busy: no shooting
  const busy = (near && !near.open && near.prog > 0) || (v && !v.open && v.prog > 0);

  // the blade always strikes what reaches it, even on the move; the gun fires only standing still, and only when fire is on
  if (!sorting && p.mcd <= 0) {
    const bw = wstat(bladeOf(p));
    strike(r, { ...bw, dmg: Math.round(bw.dmg * (1 + p.st.mel)) });
  }
  const gw = p.eq.gun && wstat(p.eq.gun),
    wd = gw && { ...gw, rate: gw.rate * (1 + p.st.fire) };
  if (wd && !sorting && !busy && prefs.fire && !moving && p.still > 0.08 && p.cd <= 0) {
    let best: Enemy | null = null,
      bd = wd.range;
    // the gun only opens up on enemies already onto the player: approaching unseen stays the player's call
    for (const e of r.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd && (e.aggro || suspicious(e)) && los(r.walls, p, e)) {
        bd = d;
        best = e;
      }
    }
    if (best) {
      const a0 = Math.atan2(best.y - p.y, best.x - p.x);
      p.face = a0;
      p.cd = 1 / wd.rate;
      for (let i = 0; i < wd.pel; i++) {
        const a = a0 + rnd(-wd.spr, wd.spr),
          sp = 680;
        r.bullets.push({
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: (wd.range / sp) * 1.1,
          dmg: wd.dmg,
        });
      }
      burst(r, p.x + Math.cos(a0) * 18, p.y + Math.sin(a0) * 18, C.accent, 3, 60, true);
      noise(r, p.x, p.y, wd.noise);
      r.flash = 0.07;
      const ea = a0 + 1.57 + rnd(-0.3, 0.3),
        es = rnd(90, 150);
      r.cas.push({ x: p.x, y: p.y, vx: Math.cos(ea) * es, vy: Math.sin(ea) * es, r: rnd(0, 6.28), vr: rnd(-18, 18) });
    }
  }
  r.flash -= dt;

  for (let i = r.cas.length - 1; i >= 0; i--) {
    const s = r.cas[i],
      f = Math.pow(0.015, dt);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.r += s.vr * dt;
    s.vx *= f;
    s.vy *= f;
    s.vr *= f;
    if (Math.hypot(s.vx, s.vy) < 6) {
      stampCasing(r.decal, s.x, s.y, s.r);
      r.cas.splice(i, 1);
    }
  }

  for (let i = r.pick.length - 1; i >= 0; i--) {
    const k = r.pick[i],
      d = Math.hypot(k.x - p.x, k.y - p.y);
    if (sorting) break;
    if (k.nop) {
      if (d > 52) k.nop = false;
      continue;
    }
    if (d >= 26) continue;
    if (bagUsed(r.bag) + def(k.it.k).s <= rcap(r)) {
      const d = def(k.it.k);
      r.bag.push(k.it);
      r.pick.splice(i, 1);
      toast((d.r >= 2 ? RAR[d.r] + " : " : "+ ") + d.n);
      updHud(r);
    } else say(r, "Sac plein : ouvre le sac pour échanger");
  }

  r.flowT -= dt;
  if (r.flowT <= 0) {
    r.flowT = 0.35;
    updFlow(r.nav, p.x, p.y);
  }
  for (const e of r.enemies) {
    updateEnemy(r, e, dt);
    if (over()) return;
  }

  for (let i = r.bullets.length - 1; i >= 0; i--) {
    const b = r.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || inWall(r.walls, b.x, b.y)) {
      r.bullets.splice(i, 1);
      continue;
    }
    const e = r.enemies.find((e) => Math.hypot(e.x - b.x, e.y - b.y) < KINDS[e.kind].r + 1);
    if (!e) continue;
    r.bullets.splice(i, 1);
    if (e.kind === "shield" && frontHit(Math.atan2(p.y - e.y, p.x - e.x), b.vx, b.vy)) {
      burst(r, b.x, b.y, "#dfe8f0", 5, 140, true);
      hitEnemy(r, e, Math.max(1, Math.round(b.dmg * 0.15)), b.x, b.y);
    } else hitEnemy(r, e, b.dmg, b.x + b.vx * 0.02, b.y + b.vy * 0.02);
  }

  for (let i = r.ebul.length - 1; i >= 0; i--) {
    const b = r.ebul[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || inWall(r.walls, b.x, b.y)) {
      r.ebul.splice(i, 1);
      continue;
    }
    if (Math.hypot(b.x - p.x, b.y - p.y) < 14) {
      r.ebul.splice(i, 1);
      hurt(r, b.dmg);
      if (over()) return;
    }
  }

  for (let i = r.nums.length - 1; i >= 0; i--) {
    const n = r.nums[i];
    n.y -= 40 * dt;
    n.life -= dt;
    if (n.life <= 0) r.nums.splice(i, 1);
  }
  for (let i = r.parts.length - 1; i >= 0; i--) {
    const q = r.parts[i];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.9;
    q.vy *= 0.9;
    q.life -= dt;
    if (q.life <= 0) r.parts.splice(i, 1);
  }

  if (r.dead > 0) return;
  if (!moving && r.exits.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 62)) {
    r.ext += dt;
    if (r.ext >= EXTRACT_TIME) return endRaid(true);
  } else r.ext = 0;
  r.t -= dt;
  if (r.t <= 0) return die(r, "Temps écoulé : la zone a été verrouillée.");
  r.spawnT -= dt;
  if (r.spawnT <= 0) {
    r.spawnT = r.zone.wave;
    for (let i = 0; i < 2; i++) {
      const c = freePt(r.walls, 24, (x, y) => Math.hypot(x - p.x, y - p.y) > 600);
      spawnByZone(r, c.x, c.y, r.t < 150 ? { x: p.x, y: p.y } : undefined);
    }
  }
  updHud(r);
}

export function endRaid(ok: boolean, why = "") {
  const r = R;
  if (!r) return;
  const p = r.p;
  setMode("end");
  clearStick();
  setRaidHud(false);
  if (ok) {
    const gained = r.bag.filter((i) => i.k !== FREE),
      val = gained.reduce((s, i) => s + valOf(i), 0);
    S.stash.push(...gained);
    S.lo.eq = { ...p.eq };
    S.lo.meds = p.meds;
    S.lo.keys = p.keys;
    S.st.ext++;
    S.st.best = Math.max(S.st.best, val);
    S.zx[r.zi]++;
    const opened = S.zx[r.zi] === UNLOCK_AFTER && ZONES[r.zi + 1] ? ZONES[r.zi + 1].name : "";
    const done = applyRaid({ ...r.tally, haul: val });
    save();
    renderEnd({ ok, why, val, items: gained, meds: 0, keys: 0, quests: done, power: [r.power0, power()], opened });
  } else {
    const lost = [...Object.values(p.eq), ...r.bag].filter((i): i is Item => !!i);
    const val = lost.reduce((s, i) => s + valOf(i), 0) + p.meds * def("med").v + p.keys * def("vkey").v;
    S.lo = { eq: emptyGear(), meds: 0, keys: 0 };
    S.st.dead++;
    save();
    renderEnd({ ok, why, val, items: lost, meds: p.meds, keys: p.keys, quests: [], power: [r.power0, power()], opened: "" });
  }
}
