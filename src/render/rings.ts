import type { Pt } from "../util";
import { H, W } from "../world/mapgen";
import { RING_R } from "../world/rings";
import { C, ctx } from "./canvas";
import type { Frame } from "./frame";

const O: Pt = { x: W / 2, y: H / 2 };

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
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 10]);
  ctx.lineDashOffset = -tt * 8;
  ctx.beginPath();
  ctx.arc(O.x, O.y, rad, 0, 6.29);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Ring lines over the darkness, so they show from afar: amber into the Zone chaude, red into the Cœur. */
export function ringLines(f: Frame) {
  const cols = [C.accent, C.bad];
  RING_R.forEach((rad, i) => {
    if (inView(f, rad)) line(rad, cols[i], f.tt);
  });
  ctx.globalAlpha = 1;
}
