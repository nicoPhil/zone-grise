import { def } from "../items";
import { AIM_TIME, lockCentre, type Pickup } from "../raid";
import { clamp, type Rect } from "../util";
import { C, ctx, rarCol, sg, shade } from "./canvas";
import { GOLD, crateCol, glow, particles, polyPath, type Frame } from "./frame";

/** Everything outside the line of sight goes dark. */
export function darkness({ p, vr, poly, world }: Frame) {
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.globalCompositeOperation = "source-over";
  sg.fillStyle = "rgba(4,5,7,.9)";
  sg.fillRect(0, 0, shade.width, shade.height);
  world(sg);
  sg.globalCompositeOperation = "destination-out";
  const lg = sg.createRadialGradient(p.x, p.y, vr * 0.3, p.x, p.y, vr);
  lg.addColorStop(0, "rgba(0,0,0,1)");
  lg.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = lg;
  polyPath(sg, poly);
  sg.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(shade, 0, 0);
  world(ctx);
}

/** Walls stay visible above the darkness, dimmer with distance. */
export function walls({ p, vr, near }: Frame, locks: Set<Rect>) {
  const dg = ctx.createRadialGradient(p.x, p.y, 40, p.x, p.y, vr * 1.15);
  dg.addColorStop(0, "rgba(0,0,0,0)");
  dg.addColorStop(1, "rgba(0,0,0,.78)");
  for (const w of near) {
    if (locks.has(w)) continue;
    ctx.fillStyle = "#c9611f";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = "#474747";
    ctx.fillRect(w.x + 5, w.y + 5, w.w - 10, w.h - 10);
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(w.x + 5, w.y + 5, w.w - 10, 3);
    ctx.fillStyle = dg;
    ctx.fillRect(w.x, w.y, w.w, w.h);
  }
}

export function drawLock(l: Rect) {
  ctx.fillStyle = "#3a2e12";
  ctx.fillRect(l.x, l.y, l.w, l.h);
  ctx.fillStyle = GOLD;
  const along = l.w > l.h;
  for (let o = 6; o < (along ? l.w : l.h) - 2; o += 12)
    along ? ctx.fillRect(l.x + o, l.y + 2, 4, l.h - 4) : ctx.fillRect(l.x + 2, l.y + o, l.w - 4, 4);
  const m = lockCentre(l);
  ctx.fillStyle = "#1a1408";
  ctx.fillRect(m.x - 7, m.y - 4, 14, 11);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(m.x - 7, m.y - 4, 14, 11);
  ctx.beginPath();
  ctx.arc(m.x, m.y - 4, 5, Math.PI, 0);
  ctx.stroke();
}

function lootGlow({ tt, inView }: Frame, q: Pickup) {
  const rr = def(q.it.k).r,
    col = rarCol(rr);
  glow(q, 22, col, 0.45);
  // rare and epic loot sends a light beam up through the darkness
  if (rr < 2 || !inView(q.x, q.y, 400)) return;
  const bg = ctx.createLinearGradient(q.x, q.y, q.x, q.y - 320);
  bg.addColorStop(0, col);
  bg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.3 + 0.1 * Math.sin(tt * 4 + q.x);
  ctx.fillStyle = bg;
  const half = rr === 3 ? 7 : 5;
  ctx.fillRect(q.x - half, q.y - 320, 2 * half, 320);
  ctx.globalAlpha = 1;
}

/** Additive light sources: vault locks, exits, special crates, loot and the muzzle flash. */
export function lights(f: Frame, locks: Set<Rect>) {
  const { r, p, tt } = f;
  for (const l of locks) glow(lockCentre(l), 70, GOLD, 0.25 + 0.08 * Math.sin(tt * 2.5));
  for (const e of r.exits) glow(e, 130, C.ok, 0.32 + 0.1 * Math.sin(tt * 3));
  // the extraction flare
  if (r.call) glow(r.call, 260, C.ok, 0.3 + 0.25 * Math.abs(Math.sin(tt * 4)));
  for (const c of r.crates) if (!c.open && (c.tier === 2 || c.vault)) glow(c, 46, crateCol(c), 0.2 + 0.08 * Math.sin(tt * 2 + c.x));
  for (const q of r.pick) lootGlow(f, q);
  if (r.flash > 0) {
    ctx.save();
    polyPath(ctx, f.poly);
    ctx.clip();
    glow({ x: p.x + Math.cos(p.face) * 20, y: p.y + Math.sin(p.face) * 20 }, 260, "rgba(255,176,80,1)", (0.5 * r.flash) / 0.07);
    ctx.restore();
  }
}

/** Sniper lasers, tracers, enemy rounds and glowing sparks, still in the additive pass. */
export function shots({ r, p }: Frame) {
  ctx.lineCap = "round";
  // a sniper's laser shows the shot coming, even from out of sight
  for (const e of r.enemies)
    if (e.kind === "sniper" && e.ph) {
      const f = clamp(e.t / AIM_TIME, 0, 1);
      ctx.strokeStyle = `rgba(255,40,40,${0.25 + 0.6 * f})`;
      ctx.lineWidth = 1 + 2 * f;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  for (const b of r.bullets) {
    ctx.strokeStyle = "rgba(255,190,90,.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025);
    ctx.stroke();
    ctx.strokeStyle = "#ffe2a8";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const b of r.ebul) {
    glow(b, 16, C.enemy2, 0.8);
    ctx.fillStyle = "#ffd0a0";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, 6.28);
    ctx.fill();
  }
  particles(r, true);
}
