import { FREE, def, emptyGear, valOf, type Item } from "./items";
import { clearStick, moveVec } from "./input";
import { applyRaid } from "./progression";
import { stampCasing } from "./render/decor";
import { S, mode, save, setMode } from "./state";
import { setRaidHud, updHud } from "./ui/hud";
import { renderEnd } from "./ui/end";
import type { Pt } from "./util";
import { collide } from "./world/geometry";
import { freePt } from "./world/mapgen";
import { updFlow } from "./world/nav";
import { ZONES, UNLOCK_AFTER, power } from "./zones";
import { moveBullets, moveEnemyBullets, playerAttacks } from "./raid/combat";
import { R, burst, die, noise, over } from "./raid/core";
import { spawnByZone, updateEnemy } from "./raid/enemies";
import { pickUp, search } from "./raid/loot";
import { EXTRACT_TIME, RUN, STEP_NOISE, STEP_TIME, type Raid } from "./raid/model";

export * from "./raid/model";
export { R, clock } from "./raid/core";
export { sight } from "./raid/enemies";
export { GROUND_R, bladeOf, drop, equip, ground, heal, rcap, setSlot, useItem } from "./raid/loot";
export { startRaid } from "./raid/start";

/** Time step of this frame: slowed during the death sequence, null once the raid has ended. */
function deathClock(r: Raid, dt: number): number | null {
  if (r.dead <= 0) return dt;
  r.dead -= dt;
  if (r.dead > 0) return dt * 0.25;
  endRaid(false, r.why);
  return null;
}

function movePlayer(r: Raid, m: Pt, dt: number) {
  const p = r.p,
    moving = m.x !== 0 || m.y !== 0,
    spd = (p.boost > 0 ? 236 : 175) * (1 + p.st.spd);
  p.x += m.x * spd * dt;
  p.y += m.y * spd * dt;
  collide(r.walls, p, 13);
  p.boost -= dt;
  p.swing -= dt;
  p.faceLock -= dt;
  if (moving && p.faceLock <= 0) p.face = Math.atan2(m.y, m.x);
  p.still = moving ? 0 : p.still + dt;
  p.step -= dt;
  if (Math.hypot(m.x, m.y) > RUN && p.step <= 0) {
    p.step = STEP_TIME;
    noise(r, p, STEP_NOISE * (1 - p.st.quiet));
    burst(r, { x: p.x, y: p.y + 8 }, "#b9ad94", { n: 4, sp: 45 });
  }
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
}

function settleCasings(r: Raid, dt: number) {
  const f = 0.015 ** dt;
  for (let i = r.cas.length - 1; i >= 0; i--) {
    const s = r.cas[i];
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
}

function fadeEffects(r: Raid, dt: number) {
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
}

/** False once the enemies' turn has ended the raid. */
function moveEnemies(r: Raid, dt: number): boolean {
  r.flowT -= dt;
  if (r.flowT <= 0) {
    r.flowT = 0.35;
    updFlow(r.nav, r.p.x, r.p.y);
  }
  for (const e of r.enemies) {
    updateEnemy(r, e, dt);
    if (over()) return false;
  }
  return true;
}

/** Extraction, the raid timer and enemy waves; false once the raid is over. */
function raidClocks(r: Raid, moving: boolean, dt: number): boolean {
  const p = r.p;
  if (!moving && r.exits.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 62)) {
    r.ext += dt;
    if (r.ext >= EXTRACT_TIME) {
      endRaid(true);
      return false;
    }
  } else r.ext = 0;
  r.t -= dt;
  if (r.t <= 0) {
    die(r, "Temps écoulé : la zone a été verrouillée.");
    return false;
  }
  r.spawnT -= dt;
  if (r.spawnT > 0) return true;
  r.spawnT = r.zone.wave;
  for (let i = 0; i < 2; i++) {
    const c = freePt(r.walls, 24, (x, y) => Math.hypot(x - p.x, y - p.y) > 600);
    spawnByZone(r, c, r.t < 150 ? { x: p.x, y: p.y } : undefined);
  }
  return true;
}

export function update(frame: number) {
  const r = R;
  if (!r) return;
  const dt = deathClock(r, frame);
  if (dt === null) return;
  // the raid keeps running while the bag is open: the player stands still, doesn't fight and isn't spotted
  const sorting = mode === "bag" || r.dead > 0;
  const m = sorting ? { x: 0, y: 0 } : moveVec(),
    moving = m.x !== 0 || m.y !== 0;
  movePlayer(r, m, dt);
  const busy = search(r, !moving && !sorting, dt);
  playerAttacks(r, { sorting, busy, moving });
  r.flash -= dt;
  settleCasings(r, dt);
  if (!sorting) pickUp(r);
  if (!moveEnemies(r, dt)) return;
  moveBullets(r, dt);
  if (!moveEnemyBullets(r, dt)) return;
  fadeEffects(r, dt);
  if (r.dead > 0 || !raidClocks(r, moving, dt)) return;
  updHud(r);
}

function extracted(r: Raid) {
  const p = r.p,
    gained = r.bag.filter((i) => i.k !== FREE),
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
  renderEnd({ ok: true, why: "", val, items: gained, meds: 0, keys: 0, quests: done, power: [r.power0, power()], opened });
}

function lost(r: Raid, why: string) {
  const p = r.p,
    items = [...Object.values(p.eq), ...r.bag].filter((i): i is Item => !!i);
  const val = items.reduce((s, i) => s + valOf(i), 0) + p.meds * def("med").v + p.keys * def("vkey").v;
  S.lo = { eq: emptyGear(), meds: 0, keys: 0 };
  S.st.dead++;
  save();
  renderEnd({ ok: false, why, val, items, meds: p.meds, keys: p.keys, quests: [], power: [r.power0, power()], opened: "" });
}

export function endRaid(ok: boolean, why = "") {
  const r = R;
  if (!r) return;
  setMode("end");
  clearStick();
  setRaidHud(false);
  if (ok) extracted(r);
  else lost(r, why);
}
