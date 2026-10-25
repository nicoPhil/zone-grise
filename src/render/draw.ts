import type { Raid } from "../raid";
import { actors } from "./actors";
import { C, ctx, cv } from "./canvas";
import { frame } from "./frame";
import { darkness, drawLock, lights, shots, walls } from "./light";
import { markers } from "./marks";
import { overlay } from "./overlay";
import { groundItems, groundTiles, stains } from "./world";

export function draw(r: Raid | null) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!r) return;
  const f = frame(r);
  f.world(ctx);
  groundTiles(f);
  stains(f);
  groundItems(f);
  actors(f);
  darkness(f);
  const locks = new Set(r.vault && !r.vault.open ? r.vault.locks : []);
  walls(f, locks);
  for (const l of locks) drawLock(l);
  ctx.globalCompositeOperation = "lighter";
  lights(f, locks);
  shots(f);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "butt";
  markers(f);
  overlay(f);
}
