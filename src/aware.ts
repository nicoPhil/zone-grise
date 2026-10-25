import type { Pt } from "./util";

/** What an enemy knows of the player: unaware, suspicious ("?"), or hunting ("!"). */
export interface Awareness {
  aggro: boolean;
  /** where to look: the last known player position, or the last noise heard */
  lx: number;
  ly: number;
  /** seconds hunting without seeing the player */
  lost: number;
  /** search time left */
  sr: number;
  /** marker pop animation */
  al: number;
  /** suspicion: fills while the player is in view, spotted at 1 */
  sus: number;
}

export const LOSE_TIME = 3.5,
  SEARCH_TIME = 5,
  WAVE_SEARCH = 12,
  ALERT_POP = 0.5;
/** Half-angle of the view cone; within FEEL_R an enemy notices the player whichever way it faces. */
export const CONE_HALF = 0.8,
  FEEL_R = 60;

export const suspicious = (e: Awareness) => !e.aggro && (e.sus > 0 || e.sr > 0);

/** Spotted or hit: hunts towards (x,y). */
export function alert(e: Awareness, x: number, y: number) {
  if (!e.aggro) [e.aggro, e.al, e.lost] = [true, ALERT_POP, 0];
  else e.lost = Math.min(e.lost, 0);
  [e.lx, e.ly, e.sr, e.sus] = [x, y, 0, 1];
}

/** A noise draws an unaware enemy to check where it came from; a hunter just keeps the trail. */
export function hear(e: Awareness, x: number, y: number, secs = SEARCH_TIME) {
  if (e.aggro) return alert(e, x, y);
  if (!suspicious(e)) e.al = ALERT_POP;
  [e.lx, e.ly, e.sr] = [x, y, Math.max(e.sr, secs)];
}

export function inCone(face: number, e: Pt, p: Pt, range: number, half: number) {
  const dx = p.x - e.x,
    dy = p.y - e.y,
    d = Math.hypot(dx, dy);
  if (d < FEEL_R) return true;
  if (d > range) return false;
  const da = Math.atan2(dy, dx) - face;
  return Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) < half;
}

/** Suspicion fills while the player is in view, from 0.2 s up close to 1.1 s at the edge of the cone, and fades out of view. */
export function watch(e: Awareness, view: boolean, d: number, range: number, p: Pt, dt: number) {
  if (e.aggro) return;
  if (!view) {
    e.sus = Math.max(0, e.sus - dt * 0.4);
    return;
  }
  if (!suspicious(e)) e.al = ALERT_POP;
  e.sus += dt / (0.2 + 0.9 * Math.min(d / range, 1));
  [e.lx, e.ly, e.sr] = [p.x, p.y, SEARCH_TIME];
  if (e.sus >= 1) alert(e, p.x, p.y);
}

export function track(e: Awareness, see: boolean, p: Pt, dt: number) {
  e.al -= dt;
  if (!e.aggro) e.sr -= dt;
  else if (see) alert(e, p.x, p.y);
  else {
    e.lost += dt;
    if (e.lost > LOSE_TIME) [e.aggro, e.sr, e.sus] = [false, SEARCH_TIME, 0];
  }
}
