import { hear } from "../aware";
import { clearStick } from "../input";
import { mode } from "../state";
import { closeBag } from "../ui/bag";
import { toast } from "../ui/hud";
import { rnd, type Pt } from "../util";
import { los } from "../world/geometry";
import { DEATH_TIME, type Enemy, type Raid } from "./model";
import { absorb } from "./shield";

export let R: Raid | null = null;
export const setRaid = (r: Raid) => {
  R = r;
};
export const clock = { last: performance.now() };

/** The raid has ended (death or extraction) during this frame; sorting the bag still counts as in the raid. */
export const over = () => mode !== "raid" && mode !== "bag";

export function burst(r: Raid, at: Pt, col: string, { n = 8, sp = 140, glow = false } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28),
      s = rnd(30, sp);
    r.parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.2, 0.5), col, glow });
  }
}

export const noise = (r: Raid, at: Pt, rad: number, from?: Enemy) => {
  // walls muffle: through them a noise carries half as far
  for (const e of r.enemies) {
    if (e === from) continue;
    const d = Math.hypot(e.x - at.x, e.y - at.y);
    if (d < rad / 2 || (d < rad && los(r.walls, e, at))) hear(e, at.x, at.y);
  }
};

export function say(r: Raid, msg: string) {
  if (r.toastT > 0) return;
  toast(msg);
  r.toastT = 2.5;
}

/** The raid is lost: a slow-motion death sequence plays before the end screen. */
export function die(r: Raid, why: string) {
  if (r.dead > 0) return;
  [r.dead, r.why, r.shake] = [DEATH_TIME, why, 0.5];
  if (mode === "bag") closeBag();
  clearStick();
}

export function hurt(r: Raid, base: number) {
  if (over() || r.dead > 0) return;
  const p = r.p,
    d = base * r.zone.dmg,
    rest = d - absorb(p.sh, d);
  r.shake = 0.12 + 0.004 * d;
  if (rest <= 0) return;
  // what the shield lets through is softened by armour
  p.hp -= rest * (1 - p.st.red);
  r.dmg += rest * (1 - p.st.red);
  p.hit = 0.15;
  if (p.hp <= 0) die(r, "Tu es mort.");
}
