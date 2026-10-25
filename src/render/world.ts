import { def } from "../items";
import type { Crate } from "../raid";
import { clamp } from "../util";
import { H, W } from "../world/mapgen";
import { T, floorPattern, tile } from "./assets";
import { ctx, rarCol } from "./canvas";
import { DECAL, GN } from "./decor";
import { crateCol, type Frame } from "./frame";

export function groundTiles({ r, cx, cy, ww, wh }: Frame) {
  const i0 = clamp(Math.floor(cx / T), 0, GN - 1),
    i1 = clamp(Math.floor((cx + ww) / T), 0, GN - 1);
  const j0 = clamp(Math.floor(cy / T), 0, GN - 1),
    j1 = clamp(Math.floor((cy + wh) / T), 0, GN - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) tile(r.ground[j * GN + i], i * T, j * T, T + 0.6);
  for (const b of r.bld)
    if (b.x < cx + ww && b.x + b.w > cx && b.y < cy + wh && b.y + b.h > cy) {
      ctx.fillStyle = floorPattern(b.floor);
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
}

/** Stains, decor and the walls' cast shadows. */
export function stains({ r, cx, cy, ww, wh, near, inView }: Frame) {
  const sx0 = clamp(cx, 0, W),
    sy0 = clamp(cy, 0, H),
    sx1 = clamp(cx + ww, 0, W),
    sy1 = clamp(cy + wh, 0, H);
  if (sx1 > sx0 && sy1 > sy0)
    ctx.drawImage(r.decal.c, sx0 * DECAL, sy0 * DECAL, (sx1 - sx0) * DECAL, (sy1 - sy0) * DECAL, sx0, sy0, sx1 - sx0, sy1 - sy0);
  for (const o of r.decor)
    if (inView(o.x, o.y)) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.r);
      tile(o.t, -o.s / 2, -o.s / 2, o.s);
      ctx.restore();
    }
  ctx.fillStyle = "rgba(0,0,0,.45)";
  for (const w of near) ctx.fillRect(w.x + 7, w.y + 9, w.w, w.h);
}

function drawCrate(c: Crate) {
  const h = c.tier === 0 && !c.vault ? 12 : 17;
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.fillRect(c.x - h + 4, c.y - h + 6, 2 * h - 2, 2 * h - 2);
  tile([20, 4], c.x - h, c.y - h, 2 * h);
  ctx.globalAlpha = c.tier === 2 && !c.vault ? 0.6 : 0.4;
  ctx.fillStyle = crateCol(c);
  ctx.fillRect(c.x - h, c.y - h, 2 * h, 2 * h);
  ctx.globalAlpha = 1;
  if (c.open) {
    ctx.fillStyle = "rgba(10,8,6,.62)";
    ctx.fillRect(c.x - h, c.y - h, 2 * h, 2 * h);
    return;
  }
  ctx.fillStyle = crateCol(c);
  ctx.fillRect(c.x - h, c.y - h - 2, 2 * h, 4);
  // hazard stripes on a military crate
  if (c.tier === 2 && !c.vault) {
    ctx.fillStyle = "#1c1c14";
    for (let x = -h; x < h; x += 8) ctx.fillRect(c.x + x, c.y - h - 2, 4, 4);
  }
}

/** Crates, loot and spent casings. */
export function groundItems({ r, tt, inView }: Frame) {
  for (const c of r.crates) if (inView(c.x, c.y)) drawCrate(c);
  for (const q of r.pick) {
    ctx.fillStyle = rarCol(def(q.it.k).r);
    ctx.save();
    ctx.translate(q.x, q.y + Math.sin(tt * 3 + q.x) * 1.5);
    ctx.rotate(0.785);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.strokeStyle = "rgba(0,0,0,.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }
  ctx.fillStyle = "#c79a45";
  for (const s of r.cas) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.r);
    ctx.fillRect(-3, -1.2, 6, 2.4);
    ctx.restore();
  }
}
