import { CONE_HALF, WAVE_SEARCH, hear, inCone, track, watch } from "../aware";
import { mode } from "../state";
import { clamp, rnd, type Pt } from "../util";
import { collide, inWall, los } from "../world/geometry";
import { freePt } from "../world/mapgen";
import { CORE, RING_HP, RING_POW, ringOf } from "../world/rings";
import { cellOf, flowDir, updFlow } from "../world/nav";
import { killed } from "./combat";
import { hurt, noise } from "./core";
import { AIM_TIME, KINDS, LUNGE_R, PACK_R, type Enemy, type Kind, type KindStats, type Player, type Raid } from "./model";

/** A wave enemy is lured towards where the player was when it appeared; a pack shares its leader's ring. */
export function spawn(r: Raid, kind: Kind, at: Pt, { lure, ring = ringOf(at.x, at.y) }: { lure?: Pt; ring?: number } = {}) {
  const hp = Math.round(KINDS[kind].hp * r.zone.hp * RING_HP[ring]),
    fa = rnd(0, 6.28);
  const e: Enemy = {
    kind,
    ring,
    x: at.x,
    y: at.y,
    hp,
    max: hp,
    aggro: false,
    lx: at.x,
    ly: at.y,
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

/** View cone of an enemy; a searching one, or one from the Cœur, is on the lookout and sees further. */
export const sight = (e: Enemy, p: Player) => ({
  range: KINDS[e.kind].see * (e.sr > 0 ? 1.2 : 1) * (e.ring === CORE ? 1.2 : 1) * (1 - p.st.quiet),
  half: e.kind === "sniper" ? 0.4 : CONE_HALF,
});

type Spawner = () => void;
interface Spawners {
  one: (k: Kind) => Spawner;
  pack: (k: Kind, n: number, lead?: Kind) => Spawner;
}

/** Tier 0 at the edge, 1 in the Zone chaude, 2 armed squads in the Cœur. */
function spawnTable(tier: number, opt: (k: Kind, w: number) => number, { one, pack }: Spawners): [number, Spawner][] {
  if (tier === 0)
    return [
      [85, one("walker")],
      [opt("bloat", 15), one("bloat")],
    ];
  if (tier === 1)
    return [
      [40, pack("runner", Math.random() < 0.5 ? 2 : 3)],
      [35, one("walker")],
      [15, one("gunner")],
      [opt("bloat", 15), one("bloat")],
      [opt("alpha", 15), pack("runner", 3, "alpha")],
    ];
  return [
    [30, pack("gunner", Math.random() < 0.5 ? 0 : 1, "gunner")],
    [25, one("walker")],
    [opt("bloat", 12), one("bloat")],
    [opt("smg", 14), pack("gunner", Math.random() < 0.5 ? 0 : 1, "smg")],
    [opt("sniper", 12), one("sniper")],
    [opt("shield", 14), pack("gunner", Math.random() < 0.5 ? 0 : 1, "shield")],
    [opt("stalker", 12), pack("stalker", Math.random() < 0.4 ? 1 : 0, "stalker")],
    [opt("alpha", 12), pack("runner", 3, "alpha")],
  ];
}

/** Walkers at the edge, runner packs further in, gunners near the centre; harder zones shift the mix inwards and add their own kinds. */
export function spawnByZone(r: Raid, at: Pt, lure?: Pt) {
  const near = (): Pt => {
    const nx = at.x + rnd(-40, 40),
      ny = at.y + rnd(-40, 40);
    return inWall(r.walls, nx, ny, 14) ? at : { x: nx, y: ny };
  };
  const ring = ringOf(at.x, at.y);
  const one = (k: Kind) => () => spawn(r, k, at, { lure, ring });
  const pack = (k: Kind, n: number, lead?: Kind) => () => {
    if (lead) spawn(r, lead, at, { lure, ring });
    for (let i = 0; i < n; i++) spawn(r, k, near(), { lure, ring });
  };
  // from the Cœur zone on, every ring fields the next tier
  const tier = Math.min(2, ring + (r.zone.lo >= 0.5 ? 1 : 0));
  const table = spawnTable(tier, (k, w) => (r.zone.adds.includes(k) ? w : 0), { one, pack });
  let roll = Math.random() * table.reduce((s, [w]) => s + w, 0);
  for (const [w, go] of table) {
    roll -= w;
    if (roll < 0) return go();
  }
}

/** A wave: two groups 700 to 1400 px from the player, searching towards `lure` if given. */
export function reinforce(r: Raid, lure?: Pt) {
  const p = r.p;
  for (let i = 0; i < 2; i++)
    spawnByZone(
      r,
      freePt(r.walls, 24, (x, y) => Math.abs(Math.hypot(x - p.x, y - p.y) - 1050) < 350),
      lure,
    );
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

/** One enemy's view of the player this frame. */
interface Ctx {
  r: Raid;
  e: Enemy;
  k: KindStats;
  dx: number;
  dy: number;
  d: number;
  see: boolean;
  dt: number;
}

const still = (): Pt => ({ x: 0, y: 0 });

/** Straight at the player in sight, otherwise along the flow field around walls. */
function toward(c: Ctx, spd: number): Pt {
  const g = (c.see ? null : flowDir(c.r.nav, c.e.x, c.e.y)) || { x: c.dx / c.d, y: c.dy / c.d };
  return { x: g.x * spd, y: g.y * spd };
}
const away = (c: Ctx, spd: number): Pt => ({ x: (-c.dx / c.d) * spd, y: (-c.dy / c.d) * spd });

interface Volley {
  n: number;
  spread: number;
  speed: number;
  dmg: number;
}

function shoot(r: Raid, e: Enemy, a: number, { n, spread, speed, dmg }: Volley) {
  for (let i = 0; i < n; i++) {
    const b = a + (n > 1 ? -spread + (2 * spread * i) / (n - 1) : rnd(-spread, spread));
    r.ebul.push({ x: e.x, y: e.y, vx: Math.cos(b) * speed, vy: Math.sin(b) * speed, life: 1.6, dmg: dmg * RING_POW[e.ring] });
  }
  // a firefight draws the neighbours to the shooter
  noise(r, e, e.kind === "sniper" ? 380 : 200, e);
}
const fireAt = (c: Ctx, v: Volley) => shoot(c.r, c.e, Math.atan2(c.dy, c.dx), v);

/** Hits the player in contact; true when it did. */
function bite({ r, e, k, d }: Ctx): boolean {
  if (d >= k.r + 16 || e.cd > 0) return false;
  hurt(r, k.melee * RING_POW[e.ring]);
  e.cd = k.hitCd;
  return true;
}

function search(r: Raid, e: Enemy, k: KindStats): Pt {
  const g = goTo(r, e, e.lx, e.ly),
    v = Math.min(k.spd * 0.6, 110);
  if (g) {
    e.ta = Math.atan2(g.y, g.x);
    return { x: g.x * v, y: g.y * v };
  }
  if (e.wt <= 0) [e.ta, e.wt] = [rnd(0, 6.28), rnd(0.8, 1.5)];
  return still();
}

function wander(e: Enemy): Pt {
  if (e.wt <= 0) {
    // guards, snipers and stalkers hold their spot and only look around
    const a = rnd(0, 6.28),
      stay = e.kind === "boss" || e.kind === "stalker" || e.kind === "sniper" || Math.random() < 0.4;
    [e.wx, e.wy, e.ta, e.wt] = stay ? [0, 0, a, rnd(1.5, 3.5)] : [Math.cos(a), Math.sin(a), a, rnd(1.5, 4)];
  }
  return { x: e.wx * 40, y: e.wy * 40 };
}

function idle(c: Ctx, view: boolean): Pt {
  const { e, dt } = c;
  e.wt -= dt;
  let v = still();
  // a suspicious enemy stops and stares while it makes up its mind
  if (view) e.ta = Math.atan2(c.dy, c.dx);
  else v = e.sr > 0 ? search(c.r, e, c.k) : wander(e);
  const da = Math.atan2(Math.sin(e.ta - e.fa), Math.cos(e.ta - e.fa));
  e.fa += clamp(da, -3 * dt, 3 * dt);
  return v;
}

/** Once lit, the fuse burns out even if the player steps away; null once it has blown. */
function bloat(c: Ctx): Pt | null {
  const { e, k } = c;
  if (!e.ph && c.d < k.r + 30) e.ph = 1;
  if (!e.ph) return toward(c, k.spd);
  e.t += c.dt;
  if (e.t < 0.6) return still();
  killed(c.r, e);
  return null;
}

/** Stands still to aim; breaking the line of sight cancels the shot. */
function sniper(c: Ctx): Pt {
  const { e, k, d, see } = c;
  e.ph = see && d < 760 && e.cd <= 0 ? 1 : 0;
  e.t = e.ph ? e.t + c.dt : 0;
  if (e.t >= AIM_TIME) {
    fireAt(c, { n: 1, spread: 0, speed: 950, dmg: 22 });
    e.cd = rnd(1.6, 2.2);
    e.t = e.ph = 0;
    return still();
  }
  if (e.ph) return still();
  if (!see || d > 760) return toward(c, k.spd);
  return d < 260 ? away(c, k.spd) : still();
}

/** Creeps up unseen, then charges for a short burst and rests. */
function stalker(c: Ctx): Pt {
  const { e, k } = c;
  e.t += c.dt;
  if (e.ph === 0 && c.see && c.d < LUNGE_R) [e.ph, e.t] = [1, 0];
  else if (e.ph === 1 && e.t > 1.4) [e.ph, e.t] = [2, 0];
  else if (e.ph === 2 && e.t > 1.1) [e.ph, e.t] = [0, 0];
  const v = toward(c, [70, k.spd, 0][e.ph]);
  bite(c);
  return v;
}

function gunner(c: Ctx): Pt {
  const { e, d, see } = c;
  let v = still();
  if (!see || d > 320) v = toward(c, c.k.spd);
  else if (d < 190) v = away(c, 70);
  if (see && d < 400 && e.cd <= 0 && e.kind === "gunner") {
    fireAt(c, { n: 1, spread: 0.06, speed: 300, dmg: 12 });
    e.cd = rnd(1.3, 1.8);
  } else if (see && d < 380 && e.cd <= 0) {
    // bursts of five quick, weaker and less accurate shots
    fireAt(c, { n: 1, spread: 0.14, speed: 320, dmg: 5 });
    e.ph = (e.ph + 1) % 5;
    e.cd = e.ph ? 0.11 : rnd(1.4, 1.9);
  }
  return v;
}

/** Runners near a living pack leader run faster. */
const howl = (r: Raid, e: Enemy) =>
  e.kind === "runner" && r.enemies.some((o) => o.kind === "alpha" && Math.hypot(o.x - e.x, o.y - e.y) < PACK_R) ? 1.35 : 1;

function brawler(c: Ctx): Pt {
  const { r, e, d, see } = c;
  const v = e.kind !== "boss" || !see || d > 240 ? toward(c, c.k.spd * howl(r, e)) : still();
  if (!bite(c) && e.kind === "boss" && see && d < 420 && e.cd <= 0) {
    fireAt(c, { n: 5, spread: 0.24, speed: 260, dmg: 12 });
    e.cd = 1.9;
  }
  return v;
}

const HUNT: Record<Kind, (c: Ctx) => Pt | null> = {
  walker: brawler,
  runner: brawler,
  boss: brawler,
  shield: brawler,
  alpha: brawler,
  gunner,
  smg: gunner,
  sniper,
  stalker,
  bloat,
};

function separate(r: Raid, e: Enemy, k: KindStats) {
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
}

/** Enemies stop at the player's edge instead of standing on top of the sprite. */
function keepOff(p: Player, e: Enemy, k: KindStats) {
  const px = e.x - p.x,
    py = e.y - p.y,
    pd = Math.hypot(px, py),
    touch = k.r + 11;
  if (pd >= touch) return;
  const ux = pd ? px / pd : Math.cos(e.wt),
    uy = pd ? py / pd : Math.sin(e.wt);
  e.x = p.x + ux * touch;
  e.y = p.y + uy * touch;
}

export function updateEnemy(r: Raid, e: Enemy, dt: number) {
  const p = r.p,
    k = KINDS[e.kind];
  const dx = p.x - e.x,
    dy = p.y - e.y,
    d = Math.hypot(dx, dy) || 1;
  e.cd -= dt;
  e.hit -= dt;
  const see = d < 600 && los(r.walls, e, p),
    { range, half } = sight(e, p);
  const view = !e.aggro && see && mode !== "bag" && inCone(e.fa, e, p, { range, half });
  // the Cœur's enemies make up their minds faster
  watch(e, { view, d, range }, p, e.ring === CORE ? dt * 1.25 : dt);
  track(e, see, p, dt);
  if (e.aggro) e.fa = e.ta = Math.atan2(dy, dx);
  const c: Ctx = { r, e, k, dx, dy, d, see, dt };
  const v = e.aggro ? HUNT[e.kind](c) : idle(c, view);
  if (!v) return;
  e.x += v.x * dt;
  e.y += v.y * dt;
  separate(r, e, k);
  keepOff(p, e, k);
  collide(r.walls, e, k.r);
}
