import type { Awareness } from "../aware";
import type { Gear, Item, Mods } from "../items";
import type { RaidTally } from "../progression";
import type { Tile } from "../render/assets";
import type { Decal, Decor } from "../render/decor";
import type { Pt, Rect } from "../util";
import type { Building } from "../world/mapgen";
import type { Nav } from "../world/nav";
import type { Shield } from "./shield";
import type { Zone } from "../zones";

export type Kind = "walker" | "runner" | "gunner" | "boss" | "smg" | "bloat" | "sniper" | "shield" | "stalker" | "alpha";
export interface KindStats {
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
  /** ring it appeared in, which sets its strength for good */
  ring: number;
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
  /** raid clock when the player first hit it */
  hitAt?: number;
}
export interface Crate extends Pt {
  d: number;
  /** 0 street debris, 1 crate, 2 military crate */
  tier: 0 | 1 | 2;
  open: boolean;
  prog: number;
  vault?: boolean;
}
export interface Bullet extends Pt {
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  /** an enemy shot the player dodged: it flies on through */
  dodged?: boolean;
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
  /** time to the next audible footstep while running */
  step: number;
  sh: Shield | null;
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
  /** the extraction called at an exit, if any: seconds left and time to the next flare */
  /** the extraction call: `left` of `total` seconds to hold out */
  call: (Pt & { left: number; total: number; ping: number }) | null;
  /** index in RINGS of the ring the player is in, and the deepest one reached */
  ring: number;
  deep: number;
  /** HP lost so far, seconds spent in the Cœur */
  dmg: number;
  dmgCore: number;
  core: number;
  /** seconds from first hit to kill, summed over the enemies killed after being hit */
  ttk: { s: number; n: number };
  /** gun bullets fired, bullets that hit an enemy, enemies the gun finished */
  gun: { fired: number; hits: number; kills: number };
  toastT: number;
  shake: number;
  flash: number;
  tally: Omit<RaidTally, "haul">;
  /** seconds left of the death sequence before the end screen, and why the raid is lost */
  dead: number;
  why: string;
}

/** Stick push from which the player runs, and the footsteps that come with it. */
export const RUN = 0.7,
  STEP_TIME = 0.35,
  STEP_NOISE = 90;
export const DEATH_TIME = 1.8,
  RAID_TIME = 180,
  CRATE_TIME = 0.8,
  CALL_TIME = 15,
  UNLOCK_TIME = 1.2;
/** Radius of an exit, and of the area around it where an extraction call keeps counting down. */
export const EXIT_R = 62,
  CALL_ZONE = 150;
/** Opening a military crate is long, and the hands are busy all along. */
export const crateTime = (c: Crate) => (c.vault ? CRATE_TIME : [0.4, 0.8, 2.5][c.tier]);

export const hasKey = (r: Raid) => r.p.keys > 0 || r.bag.some((i) => i.k === "vkey");
export const lockCentre = (l: Rect): Pt => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });
