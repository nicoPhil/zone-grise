import { alert, hear, suspicious } from "../aware";
import { KNIFE, mk, partOf, wstat, type Item, type WeaponStats } from "../items";
import { rollItem } from "../world/mapgen";
import { prefs } from "../input";
import { C } from "../render/canvas";
import { blood } from "../render/decor";
import { toast } from "../ui/hud";
import { rnd, type Pt } from "../util";
import { MELEE_ARC, collide, frontHit, inArc, inWall, los } from "../world/geometry";
import { burst, hurt, noise, over } from "./core";
import { BLAST_R, KINDS, SNEAK, type Enemy, type Raid } from "./model";

export interface Hit {
  dmg: number;
  at: Pt;
  big?: boolean;
  by?: "gun" | "blade" | "blast";
}

function blast(r: Raid, at: Pt) {
  const p = r.p;
  burst(r, at, "#a6d36a", { n: 34, sp: 260 });
  burst(r, at, "#f2a33a", { n: 16, sp: 200, glow: true });
  r.shake = Math.max(r.shake, 0.3);
  noise(r, at, 320);
  if (Math.hypot(p.x - at.x, p.y - at.y) < BLAST_R) hurt(r, 24);
  for (const o of [...r.enemies])
    if (r.enemies.includes(o) && Math.hypot(o.x - at.x, o.y - at.y) < BLAST_R)
      hitEnemy(r, o, { dmg: 60, at: { x: o.x, y: o.y }, big: true, by: "blast" });
}

export function killed(r: Raid, e: Enemy) {
  if (!r.enemies.includes(e)) return;
  r.enemies.splice(r.enemies.indexOf(e), 1);
  r.tally.kills++;
  if (e.hitAt !== undefined) {
    r.ttk.s += e.hitAt - r.t;
    r.ttk.n++;
  }
  burst(r, e, C.bad, { n: e.kind === "boss" ? 40 : 14, sp: 160 });
  blood(r.decal, e, e.kind === "boss" ? 30 : 14, true);
  const drop = (it: Item) => {
    const a = rnd(0, 6.28);
    r.pick.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, it });
  };
  // enemies only carry their own component: the real loot is in the crates
  const elite = ["smg", "sniper", "shield", "alpha", "stalker", "boss"].includes(e.kind);
  const chance = e.kind === "boss" ? 1 : 0.5 + (elite ? 0.25 : 0);
  if (Math.random() < chance) drop(mk(partOf(e.kind)));
  if (e.kind === "boss") {
    r.tally.boss++;
    drop(mk("vkey"));
    drop(rollItem(1, { minR: 2 }));
    drop(rollItem(1, { minR: 2 }));
    toast("La Brute est tombée");
    return;
  }
  if (e.kind === "bloat") return blast(r, e);
  if ((e.kind === "gunner" || elite) && Math.random() < 0.2) drop(mk("vkey"));
}

export function hitEnemy(r: Raid, e: Enemy, { dmg: base, at, big: hard = false, by = "gun" }: Hit) {
  // a blade the enemy never saw coming hits harder
  const sneak = by === "blade" && !e.aggro,
    dmg = sneak ? Math.round(base * SNEAK) : base,
    big = hard || sneak;
  e.hp -= dmg;
  e.hitAt ??= r.t;
  e.hit = big ? 0.16 : 0.1;
  r.nums.push({ x: e.x + rnd(-6, 6), y: e.y - 18, v: dmg, life: 0.7, big });
  if (by === "blast") hear(e, at.x, at.y);
  else alert(e, r.p.x, r.p.y);
  burst(r, at, C.bad, { n: 4, sp: 90 });
  blood(r.decal, at, 3, false);
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
    if (!inArc(p, a0, e, { reach: reach(e), half: MELEE_ARC })) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x),
      kb = (wd.kb || 0) * (e.kind === "boss" ? 0.2 : 1);
    e.x += Math.cos(a) * kb;
    e.y += Math.sin(a) * kb;
    collide(r.walls, e, KINDS[e.kind].r);
    hitEnemy(r, e, { dmg: wd.dmg, at: { x: e.x - Math.cos(a) * 10, y: e.y - Math.sin(a) * 10 }, big: true, by: "blade" });
    burst(r, { x: e.x - Math.cos(a) * 12, y: e.y - Math.sin(a) * 12 }, "#f4efe4", { n: 5, sp: 120, glow: true });
  }
  r.shake = Math.max(r.shake, 0.05);
  noise(r, p, wd.noise);
}

/** The gun only opens up on enemies already onto the player: approaching unseen stays the player's call. */
function gunTarget(r: Raid, range: number): Enemy | null {
  const p = r.p;
  let best: Enemy | null = null,
    bd = range;
  for (const e of r.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && (e.aggro || suspicious(e)) && los(r.walls, p, e)) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function fire(r: Raid, at: Enemy, wd: WeaponStats) {
  const p = r.p,
    a0 = Math.atan2(at.y - p.y, at.x - p.x),
    sp = 680;
  p.face = a0;
  p.cd = 1 / wd.rate;
  for (let i = 0; i < wd.pel; i++) {
    const a = a0 + rnd(-wd.spr, wd.spr);
    r.bullets.push({
      x: p.x + Math.cos(a) * 16,
      y: p.y + Math.sin(a) * 16,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: (wd.range / sp) * 1.1,
      dmg: wd.dmg,
    });
  }
  burst(r, { x: p.x + Math.cos(a0) * 18, y: p.y + Math.sin(a0) * 18 }, C.accent, { n: 3, sp: 60, glow: true });
  noise(r, p, wd.noise);
  r.flash = 0.07;
  const ea = a0 + 1.57 + rnd(-0.3, 0.3),
    es = rnd(90, 150);
  r.cas.push({ x: p.x, y: p.y, vx: Math.cos(ea) * es, vy: Math.sin(ea) * es, r: rnd(0, 6.28), vr: rnd(-18, 18) });
}

/** The blade always strikes what reaches it, even on the move; the gun fires only standing still, and only when fire is on. */
export function playerAttacks(r: Raid, { sorting, busy, moving }: { sorting: boolean; busy: boolean; moving: boolean }) {
  const p = r.p;
  if (!sorting && p.mcd <= 0) {
    const bw = wstat(p.eq.blade || KNIFE);
    strike(r, { ...bw, dmg: Math.round(bw.dmg * (1 + p.st.mel)) });
  }
  const gw = p.eq.gun && wstat(p.eq.gun);
  if (!gw || sorting || busy || !prefs.fire || moving || p.still <= 0.08 || p.cd > 0) return;
  const wd = { ...gw, rate: gw.rate * (1 + p.st.fire) },
    best = gunTarget(r, wd.range);
  if (best) fire(r, best, wd);
}

export function moveBullets(r: Raid, dt: number) {
  const p = r.p;
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
      burst(r, b, "#dfe8f0", { n: 5, sp: 140, glow: true });
      hitEnemy(r, e, { dmg: Math.max(1, Math.round(b.dmg * 0.15)), at: { x: b.x, y: b.y } });
    } else hitEnemy(r, e, { dmg: b.dmg, at: { x: b.x + b.vx * 0.02, y: b.y + b.vy * 0.02 } });
  }
}

/** False once a hit has ended the raid. */
export function moveEnemyBullets(r: Raid, dt: number): boolean {
  const p = r.p;
  for (let i = r.ebul.length - 1; i >= 0; i--) {
    const b = r.ebul[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || inWall(r.walls, b.x, b.y)) {
      r.ebul.splice(i, 1);
      continue;
    }
    if (!b.dodged && Math.hypot(b.x - p.x, b.y - p.y) < 14) {
      if (Math.random() < p.st.dodge) {
        b.dodged = true;
        burst(r, p, "#dfe8f0", { n: 4, sp: 90 });
        continue;
      }
      r.ebul.splice(i, 1);
      hurt(r, b.dmg);
      if (over()) return false;
    }
  }
  return true;
}
