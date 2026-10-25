import type { Pt } from "./util";

/** What an enemy knows of the player: hunting, searching a last known point, or idle. */
export interface Awareness {
  aggro: boolean;
  /** last known player position, searched once the trail is lost */
  lx: number;
  ly: number;
  /** seconds hunting without seeing the player; negative for wave hunters, who keep going longer */
  lost: number;
  /** search time left */
  sr: number;
  /** "!" pop animation */
  al: number;
}

export const LOSE_TIME = 3.5, SEARCH_TIME = 5, ALERT_POP = 0.5, WAVE_HUNT = 8;

/** Spotted, heard or hit: hunts towards (x,y). */
export function alert(e: Awareness, x: number, y: number) {
  if (!e.aggro) [e.aggro, e.al, e.lost] = [true, ALERT_POP, 0];
  else e.lost = Math.min(e.lost, 0);
  [e.lx, e.ly, e.sr] = [x, y, 0];
}

export function track(e: Awareness, see: boolean, p: Pt, dt: number) {
  e.al -= dt;
  if (!e.aggro) e.sr -= dt;
  else if (see) alert(e, p.x, p.y);
  else if ((e.lost += dt) > LOSE_TIME) [e.aggro, e.sr] = [false, SEARCH_TIME];
}
