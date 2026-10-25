import type { Pt } from "../util";
import { H, W } from "../world/mapgen";
import { RING_R } from "../world/rings";
import { C, ctx } from "./canvas";
import type { Frame } from "./frame";

const O: Pt = { x: W / 2, y: H / 2 };
/** How close to a ring line the player gets before chevrons show which side is further in. */
const NEAR = 320;

/** Does the circle of radius rad around the centre pass through the view? */
function inView({ cx, cy, ww, wh }: Frame, rad: number) {
  const nx = Math.max(cx - O.x, 0, O.x - cx - ww),
    ny = Math.max(cy - O.y, 0, O.y - cy - wh),
    fx = Math.max(Math.abs(cx - O.x), Math.abs(cx + ww - O.x)),
    fy = Math.max(Math.abs(cy - O.y), Math.abs(cy + wh - O.y));
  return Math.hypot(nx, ny) <= rad && rad <= Math.hypot(fx, fy);
}

function line(rad: number, col: string, tt: number) {
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(O.x, O.y, rad, 0, 6.29);
  ctx.stroke();
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.setLineDash([30, 18]);
  ctx.lineDashOffset = -tt * 12;
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A row of chevrons on the line around the player, pointing towards the centre. */
function chevrons(p: Pt, rad: number, col: string) {
  const a0 = Math.atan2(p.y - O.y, p.x - O.x);
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.9;
  for (let k = -3; k <= 3; k++) {
    const a = a0 + (k * 110) / rad;
    ctx.save();
    ctx.translate(O.x + Math.cos(a) * (rad - 22), O.y + Math.sin(a) * (rad - 22));
    ctx.rotate(a + Math.PI);
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-7, -10);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-7, 10);
    ctx.fill();
    ctx.restore();
  }
}

/** Ring lines over the darkness, so they show from afar: amber into the Zone chaude, red into the Cœur. */
export function ringLines(f: Frame) {
  const cols = [C.accent, C.bad],
    d = Math.hypot(f.p.x - O.x, f.p.y - O.y);
  RING_R.forEach((rad, i) => {
    if (!inView(f, rad)) return;
    line(rad, cols[i], f.tt);
    if (Math.abs(d - rad) < NEAR) chevrons(f.p, rad, cols[i]);
  });
  ctx.globalAlpha = 1;
}
