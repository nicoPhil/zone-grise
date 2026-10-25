import { toast } from "../ui/hud";
import type { Pt } from "../util";
import { burst, noise } from "./core";
import { reinforce } from "./enemies";
import { CALL_TIME, CALL_ZONE, EXIT_R, type Raid } from "./model";

const PING = 3,
  PING_R = 600;

function startCall(r: Raid, e: Pt) {
  const total = Math.round(CALL_TIME * (1 - r.p.st.call));
  r.call = { x: e.x, y: e.y, left: total, total, ping: 0 };
  reinforce(r, e);
  toast(`Extraction appelée : tiens ${total} s près de la sortie`);
}

/** Reaching an exit calls the extraction; it counts down while the player holds out near it, and its flare draws enemies. True once extracted. */
export function extraction(r: Raid, dt: number): boolean {
  const p = r.p;
  if (!r.call) {
    const e = r.exits.find((x) => Math.hypot(x.x - p.x, x.y - p.y) < EXIT_R);
    if (e) startCall(r, e);
    return false;
  }
  const c = r.call;
  c.ping -= dt;
  if (c.ping <= 0) {
    c.ping = PING;
    noise(r, c, PING_R);
    burst(r, c, "#9df5b5", { n: 16, sp: 240, glow: true });
  }
  if (Math.hypot(c.x - p.x, c.y - p.y) < CALL_ZONE) c.left -= dt;
  return c.left <= 0;
}
