import { clearStick } from "../input";
import { gearStats } from "../items";
import { maxHp } from "../progression";
import { furnish } from "../render/furniture";
import { THEMES, makeDecal, makeDecor, makeGround } from "../render/decor";
import { S, save, setMode } from "../state";
import { setRaidHud, showHint, updHud } from "../ui/hud";
import { pick, rnd, type Pt, type Rect } from "../util";
import { inWall } from "../world/geometry";
import { depth, freePt, genMap, inBld, placeEntries } from "../world/mapgen";
import { makeNav } from "../world/nav";
import { RING_SHARE, ringAt, ringOf } from "../world/rings";
import { pickVault } from "../world/vault";
import { ZONES, power, unlocked, zoneDepth } from "../zones";
import { clock, setRaid } from "./core";
import { spawn, spawnByZone } from "./enemies";
import { indoorTier } from "./loot";
import { RAID_TIME, type Player, type Raid } from "./model";
import { wornShield } from "./shield";

type VaultPlan = NonNullable<ReturnType<typeof pickVault>>;

function randIn(walls: Rect[], rm: Rect, pad: number): Pt | null {
  for (let t = 0; t < 60; t++) {
    const x = rnd(rm.x + pad, rm.x + rm.w - pad),
      y = rnd(rm.y + pad, rm.y + rm.h - pad);
    if (!inWall(walls, x, y, pad)) return { x, y };
  }
  return null;
}

function newPlayer(sp: Pt): Player {
  const st = gearStats(S.lo.eq);
  return {
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
    step: 0,
    sh: wornShield(S.lo.eq.shield, true),
  };
}

function newRaid(zi: number, sp: Pt, plan: VaultPlan | null, map: Pick<Raid, "walls" | "bld" | "exits">): Raid {
  const zone = ZONES[zi],
    th = THEMES[zi];
  return {
    ...map,
    zi,
    zone,
    power0: power(),
    nav: makeNav(map.walls),
    ground: makeGround(th),
    decor: [...furnish(map.bld, th.fit, th.mess), ...makeDecor(map.walls, map.bld, th)],
    decal: makeDecal(th),
    p: newPlayer(sp),
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
    call: null,
    ring: ringAt(sp.x, sp.y, 0),
    toastT: 0,
    shake: 0,
    flash: 0,
    tally: { kills: 0, violet: 0, vaults: 0, boss: 0 },
    dead: 0,
    why: "",
  };
}

const CRATES = 80,
  ROOM_CRATES = 52;

/** Debris in the street, crates in the rooms, military crates in the Cœur; enemies placed ring by ring. */
function populate(r: Raid, sp: Pt, skip: Rect | undefined) {
  const { walls, bld, zone } = r;
  const rooms = bld.flatMap((b) => b.rooms).filter((rm) => rm !== skip);
  const far = (c: Pt | null, m: number): c is Pt => !!c && Math.hypot(c.x - sp.x, c.y - sp.y) > m;
  const inRoom = (pad: number) => (rooms.length ? randIn(walls, pick(rooms), pad) : null);
  for (let i = 0; i < CRATES; i++) {
    const room = i < ROOM_CRATES;
    let c = room ? inRoom(30) : null;
    if (!far(c, 200)) c = freePt(walls, 30, (x, y) => Math.hypot(x - sp.x, y - sp.y) > 260 && (room || !inBld(bld, x, y, 10)));
    const d = zoneDepth(zone, depth(c.x, c.y)),
      tier = inBld(bld, c.x, c.y) ? indoorTier(ringOf(c.x, c.y)) : 0;
    r.crates.push({ x: c.x, y: c.y, d, tier, open: false, prog: 0 });
  }
  placeEnemies(r, sp, rooms);
}

/** Each ring gets its share of the zone's enemies, half of them in its rooms, none near the entry. */
function placeEnemies(r: Raid, sp: Pt, rooms: Rect[]) {
  const far = (x: number, y: number) => Math.hypot(x - sp.x, y - sp.y) > 600;
  for (const [ring, share] of RING_SHARE.entries()) {
    const own = rooms.filter((rm) => ringOf(rm.x + rm.w / 2, rm.y + rm.h / 2) === ring);
    for (let i = 0; i < Math.round(r.zone.enemies * share); i++) {
      let c = own.length && Math.random() < 0.5 ? randIn(r.walls, pick(own), 24) : null;
      if (!c || !far(c.x, c.y) || ringOf(c.x, c.y) !== ring) c = freePt(r.walls, 24, (x, y) => far(x, y) && ringOf(x, y) === ring);
      spawnByZone(r, c);
    }
  }
}

/** The vault's guards wait in its building, outside the locked room: the Brute in the Cœur, two gunners elsewhere. */
function guardVault(r: Raid, plan: VaultPlan) {
  for (let i = 0; i < 2; i++) {
    const c = randIn(r.walls, plan.room, 30);
    if (c) r.crates.push({ ...c, d: 1, tier: 2, open: false, prog: 0, vault: true });
  }
  const guardRooms = plan.b.rooms.filter((rm) => rm !== plan.room);
  const guardAt = () =>
    (guardRooms.length && randIn(r.walls, pick(guardRooms), 26)) ||
    freePt(r.walls, 26, (x, y) => Math.hypot(x - plan.room.x, y - plan.room.y) < 400);
  if (r.zone.boss) spawn(r, "boss", guardAt());
  else for (let i = 0; i < 2; i++) spawn(r, "gunner", guardAt());
}

export function startRaid() {
  const zi = unlocked(S, S.zone) ? S.zone : 0;
  const { walls, bld } = genMap();
  const plan = ZONES[zi].vault ? pickVault(walls, bld) : null;
  if (plan) walls.push(...plan.locks);
  const { sp, exits } = placeEntries(walls, bld, plan && { x: plan.room.x + plan.room.w / 2, y: plan.room.y + plan.room.h / 2 });
  const r = newRaid(zi, sp, plan, { walls, bld, exits });
  populate(r, sp, plan?.room);
  if (plan) guardVault(r, plan);
  setRaid(r);
  S.st.raids++;
  save();
  setMode("raid");
  clearStick();
  setRaidHud(true);
  showHint(!r.p.eq.gun);
  updHud(r);
  clock.last = performance.now();
}
