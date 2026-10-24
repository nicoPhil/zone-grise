import { armorRed, bagUsed, def, mk, valOf, wstat, type Item } from "./items";
import { applyRaid, cap, maxHp } from "./progression";
import { C } from "./render/canvas";
import { blood, makeDecal, makeDecor, makeGround, stampCasing, type Decal, type Decor } from "./render/decor";
import type { Tile } from "./render/assets";
import { S, mode, save, setMode } from "./state";
import { clearStick, moveVec } from "./input";
import { setRaidHud, showHint, toast, updHud } from "./ui/hud";
import { renderEnd } from "./ui/end";
import { pick, rnd, type Pt, type Rect } from "./util";
import { collide, inWall, los } from "./world/geometry";
import { H, W, depth, freePt, genMap, inBld, rollItem, type Building } from "./world/mapgen";
import { flowDir, makeNav, updFlow, type Nav } from "./world/nav";

export interface Enemy extends Pt {
  gun: boolean;
  hp: number;
  max: number;
  aggro: boolean;
  wx: number;
  wy: number;
  wt: number;
  cd: number;
  hit: number;
}
export interface Crate extends Pt {
  d: number;
  open: boolean;
  prog: number;
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
  cd: number;
  face: number;
  wpn: Item;
  arm: Item | null;
  meds: number;
  hit: number;
  still: number;
}
export interface Raid {
  walls: Rect[];
  bld: Building[];
  nav: Nav;
  ground: Tile[];
  decor: Decor[];
  decal: Decal;
  p: Player;
  exits: Pt[];
  crates: Crate[];
  enemies: Enemy[];
  bullets: Bullet[];
  ebul: Bullet[];
  pick: Pickup[];
  parts: Particle[];
  cas: Casing[];
  bag: Item[];
  t: number;
  spawnT: number;
  flowT: number;
  ext: number;
  toastT: number;
  shake: number;
  flash: number;
  qp: { violet: number; kills: number };
}

export const RAID_TIME = 240, CRATE_TIME = 0.8, EXTRACT_TIME = 3, VIOLET = 0.62;
export let R: Raid | null = null;
export const clock = { last: performance.now() };

function spawnEnemy(r: Raid, x: number, y: number, aggro = false) {
  const gun = Math.random() < 0.32;
  r.enemies.push({ x, y, gun, hp: gun ? 55 : 42, max: gun ? 55 : 42, aggro, wx: 0, wy: 0, wt: 0, cd: rnd(0.5, 1.5), hit: 0 });
}

export function startRaid() {
  const { walls, bld } = genMap();
  const out = (x: number, y: number) => !inBld(bld, x, y, 60);
  const e1 = freePt(walls, 70, (x, y) => Math.min(x, y, W - x, H - y) < 260 && out(x, y));
  const e2 = freePt(walls, 70, (x, y) => Math.min(x, y, W - x, H - y) < 260 && out(x, y) && Math.hypot(x - e1.x, y - e1.y) > 1400);
  const sp = freePt(walls, 30, (x, y) => out(x, y) && Math.min(Math.hypot(x - e1.x, y - e1.y), Math.hypot(x - e2.x, y - e2.y)) > 1100);
  const r: Raid = {
    walls, bld, nav: makeNav(walls), ground: makeGround(), decor: makeDecor(walls, bld), decal: makeDecal(),
    p: { x: sp.x, y: sp.y, hp: maxHp(), max: maxHp(), cd: 0, face: 0, wpn: S.lo.w || mk("rusty"), arm: S.lo.a, meds: S.lo.meds, hit: 0, still: 0 },
    exits: [e1, e2], crates: [], enemies: [], bullets: [], ebul: [], pick: [], parts: [], cas: [], bag: [],
    t: RAID_TIME, spawnT: 24, flowT: 0, ext: 0, toastT: 0, shake: 0, flash: 0, qp: { violet: 0, kills: 0 },
  };
  const rooms = bld.flatMap((b) => b.rooms);
  const far = (c: Pt | null, m: number): c is Pt => !!c && Math.hypot(c.x - sp.x, c.y - sp.y) > m;
  const inRoom = (pad: number): Pt | null => {
    for (let t = 0; t < 60; t++) {
      const rm = pick(rooms), x = rnd(rm.x + pad, rm.x + rm.w - pad), y = rnd(rm.y + pad, rm.y + rm.h - pad);
      if (!inWall(walls, x, y, pad)) return { x, y };
    }
    return null;
  };
  for (let i = 0; i < 18; i++) {
    let c = rooms.length && Math.random() < 0.75 ? inRoom(30) : null;
    if (!far(c, 200)) c = freePt(walls, 30, (x, y) => Math.hypot(x - sp.x, y - sp.y) > 260);
    r.crates.push({ x: c.x, y: c.y, d: depth(c.x, c.y), open: false, prog: 0 });
  }
  for (let i = 0; i < 11; i++) {
    let c = rooms.length && Math.random() < 0.5 ? inRoom(24) : null;
    if (!far(c, 480)) c = freePt(walls, 24, (x, y) => Math.hypot(x - sp.x, y - sp.y) > 480);
    spawnEnemy(r, c.x, c.y);
  }
  R = r;
  S.st.raids++;
  save();
  setMode("raid");
  clearStick();
  setRaidHud(true);
  showHint();
  updHud(r);
  clock.last = performance.now();
}

function burst(r: Raid, x: number, y: number, col: string, n = 8, sp = 140, glow = false) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28), s = rnd(30, sp);
    r.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.2, 0.5), col, glow });
  }
}
const noise = (r: Raid, x: number, y: number, rad: number) => {
  for (const e of r.enemies) if (Math.hypot(e.x - x, e.y - y) < rad) e.aggro = true;
};

function hurt(r: Raid, d: number) {
  const p = r.p;
  p.hp -= d * (1 - armorRed(p.arm));
  p.hit = 0.15;
  r.shake = 0.12;
  if (p.hp <= 0) endRaid(false, "Tu es mort.");
}

export function heal() {
  const r = R;
  if (!r) return;
  const p = r.p;
  if (p.hp >= p.max) return toast("PV déjà au maximum");
  if (p.meds > 0) p.meds--;
  else {
    const i = r.bag.findIndex((x) => x.k === "med");
    if (i < 0) return toast("Aucune trousse de soin");
    r.bag.splice(i, 1);
  }
  p.hp = Math.min(p.max, p.hp + 50);
  burst(r, p.x, p.y, C.ok, 10, 90);
  updHud(r);
}

/** Chase direction: straight at the player in sight, otherwise along the flow field around walls. */
function chase(r: Raid, e: Enemy, see: boolean, dx: number, dy: number, d: number): Pt {
  return (see ? null : flowDir(r.nav, e.x, e.y)) || { x: dx / d, y: dy / d };
}

export function update(dt: number) {
  const r = R;
  if (!r) return;
  const p = r.p, m = moveVec(), moving = m.x !== 0 || m.y !== 0, wd = wstat(p.wpn);
  p.x += m.x * 175 * dt;
  p.y += m.y * 175 * dt;
  collide(r.walls, p, 13);
  if (moving) p.face = Math.atan2(m.y, m.x);
  p.still = moving ? 0 : p.still + dt;
  p.cd -= dt;
  p.hit -= dt;
  r.shake -= dt;

  for (const c of r.crates) {
    if (c.open) continue;
    c.prog = Math.hypot(c.x - p.x, c.y - p.y) < 48 && !moving ? c.prog + dt : 0;
    if (c.prog < CRATE_TIME) continue;
    c.open = true;
    if (c.d > VIOLET) r.qp.violet++;
    const n = 1 + Math.floor(Math.random() * 2) + (c.d > 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.28);
      r.pick.push({ x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 24, it: rollItem(c.d) });
    }
    burst(r, c.x, c.y, C.accent, 10, 80);
  }

  // auto-fire only while standing still, at the nearest enemy in sight and in range
  if (!moving && p.still > 0.08 && p.cd <= 0) {
    let best: Enemy | null = null, bd = wd.range;
    for (const e of r.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd && los(r.walls, p, e)) {
        bd = d;
        best = e;
      }
    }
    if (best) {
      const a0 = Math.atan2(best.y - p.y, best.x - p.x);
      p.face = a0;
      p.cd = 1 / wd.rate;
      for (let i = 0; i < wd.pel; i++) {
        const a = a0 + rnd(-wd.spr, wd.spr), sp = 680;
        r.bullets.push({ x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (wd.range / sp) * 1.1, dmg: wd.dmg });
      }
      burst(r, p.x + Math.cos(a0) * 18, p.y + Math.sin(a0) * 18, C.accent, 3, 60, true);
      noise(r, p.x, p.y, wd.noise);
      r.flash = 0.07;
      const ea = a0 + 1.57 + rnd(-0.3, 0.3), es = rnd(90, 150);
      r.cas.push({ x: p.x, y: p.y, vx: Math.cos(ea) * es, vy: Math.sin(ea) * es, r: rnd(0, 6.28), vr: rnd(-18, 18) });
    }
  }
  r.flash -= dt;

  for (let i = r.cas.length - 1; i >= 0; i--) {
    const s = r.cas[i], f = Math.pow(0.015, dt);
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
    const k = r.pick[i], d = Math.hypot(k.x - p.x, k.y - p.y);
    if (k.nop) {
      if (d > 52) k.nop = false;
      continue;
    }
    if (d >= 26) continue;
    if (bagUsed(r.bag) + def(k.it.k).s <= cap()) {
      r.bag.push(k.it);
      r.pick.splice(i, 1);
      toast("+ " + def(k.it.k).n);
      updHud(r);
    } else if (r.toastT <= 0) {
      toast("Sac plein : ouvre le sac pour jeter un objet");
      r.toastT = 2.5;
    }
  }
  r.toastT -= dt;
  r.flowT -= dt;
  if (r.flowT <= 0) {
    r.flowT = 0.35;
    updFlow(r.nav, p.x, p.y);
  }

  for (const e of r.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    e.cd -= dt;
    e.hit -= dt;
    if (!e.aggro && d < 250 && los(r.walls, e, p)) e.aggro = true;
    if (e.aggro && d > 950) e.aggro = false;
    let vx = 0, vy = 0;
    if (!e.aggro) {
      e.wt -= dt;
      if (e.wt <= 0) {
        const a = rnd(0, 6.28);
        e.wx = Math.cos(a);
        e.wy = Math.sin(a);
        e.wt = rnd(1.5, 4);
        if (Math.random() < 0.4) e.wx = e.wy = 0;
      }
      vx = e.wx * 40;
      vy = e.wy * 40;
    } else if (!e.gun) {
      const g = chase(r, e, los(r.walls, e, p), dx, dy, d);
      vx = g.x * 118;
      vy = g.y * 118;
      if (d < 29 && e.cd <= 0) {
        hurt(r, 12);
        e.cd = 0.8;
      }
    } else {
      const see = los(r.walls, e, p);
      if (!see || d > 320) {
        const g = chase(r, e, see, dx, dy, d);
        vx = g.x * 85;
        vy = g.y * 85;
      } else if (d < 190) {
        vx = (-dx / d) * 70;
        vy = (-dy / d) * 70;
      }
      if (see && d < 400 && e.cd <= 0) {
        const a = Math.atan2(dy, dx) + rnd(-0.08, 0.08);
        r.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290, life: 1.6, dmg: 9 });
        e.cd = rnd(1.3, 1.8);
      }
    }
    e.x += vx * dt;
    e.y += vy * dt;
    for (const o of r.enemies) {
      if (o === e) continue;
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < 28) {
        e.x += ((ox / od) * (28 - od)) / 2;
        e.y += ((oy / od) * (28 - od)) / 2;
      }
    }
    collide(r.walls, e, 14);
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
    const e = r.enemies.find((e) => Math.hypot(e.x - b.x, e.y - b.y) < 15);
    if (!e) continue;
    e.hp -= b.dmg;
    e.hit = 0.1;
    e.aggro = true;
    r.bullets.splice(i, 1);
    burst(r, b.x, b.y, C.bad, 4, 90);
    blood(r.decal, b.x + b.vx * 0.02, b.y + b.vy * 0.02, 3, false);
    if (e.hp <= 0) {
      r.enemies.splice(r.enemies.indexOf(e), 1);
      r.qp.kills++;
      burst(r, e.x, e.y, C.bad, 14, 160);
      blood(r.decal, e.x, e.y, 14, true);
      if (Math.random() < 0.45) r.pick.push({ x: e.x, y: e.y, it: rollItem(depth(e.x, e.y)) });
    }
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
      if (mode !== "raid") return;
    }
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

  if (r.exits.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 62)) {
    r.ext += dt;
    if (r.ext >= EXTRACT_TIME) return endRaid(true);
  } else r.ext = 0;
  r.t -= dt;
  if (r.t <= 0) return endRaid(false, "Temps écoulé : la zone a été verrouillée.");
  r.spawnT -= dt;
  if (r.spawnT <= 0) {
    r.spawnT = 22;
    for (let i = 0; i < 2; i++) {
      const c = freePt(r.walls, 24, (x, y) => Math.hypot(x - p.x, y - p.y) > 600);
      spawnEnemy(r, c.x, c.y, r.t < 120);
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
    const gained = r.bag.filter((i) => i.k !== "rusty"), val = gained.reduce((s, i) => s + valOf(i), 0);
    S.stash.push(...gained);
    S.lo.w = p.wpn.k === "rusty" ? null : p.wpn;
    S.lo.a = p.arm;
    S.lo.meds = p.meds;
    S.st.ext++;
    S.st.best = Math.max(S.st.best, val);
    const done = applyRaid(r.qp.kills, r.qp.violet, val);
    save();
    renderEnd({ ok, why, val, items: gained, meds: 0, quests: done });
  } else {
    const lost = [...(p.wpn.k !== "rusty" ? [p.wpn] : []), ...(p.arm ? [p.arm] : []), ...r.bag];
    const val = lost.reduce((s, i) => s + valOf(i), 0) + p.meds * def("med").v;
    S.lo = { w: null, a: null, meds: 0 };
    S.st.dead++;
    save();
    renderEnd({ ok, why, val, items: lost, meds: p.meds, quests: [] });
  }
}
