import { def, nameOf, upgradeOver, wstat } from "../items";
import { ALERT_POP, suspicious } from "../aware";
import { STICK_R, moveVec, stick } from "../input";
import {
  AIM_TIME,
  DEATH_TIME,
  EXTRACT_TIME,
  CRATE_TIME,
  KINDS,
  UNLOCK_TIME,
  VIOLET,
  bladeOf,
  hasKey,
  lockCentre,
  sight,
  type Crate,
  type Kind,
  type Raid,
} from "../raid";
import { mode } from "../state";
import { clamp, fmtM, rnd, type Pt } from "../util";
import { MELEE_ARC, los, rayLen } from "../world/geometry";
import { H, W } from "../world/mapgen";
import { C, FONT, ctx, cv, rarCol, sg, shade, view } from "./canvas";
import { T, floorPattern, sprite, tile, type CharKey } from "./assets";
import { GN } from "./decor";

const BASE_VR = 560;
/** view radius this frame: a headlamp or visor pushes it out */
let VR = BASE_VR;
const GOLD = "#f0c040";
const crateCol = (c: Crate) => (c.vault ? GOLD : c.d > VIOLET ? C.r3 : c.d > 0.36 ? C.r2 : C.r0);
const LOOK: Record<Kind, [CharKey, number]> = {
  walker: ["zomb", 0.85],
  runner: ["zombR", 0.68],
  gunner: ["sold", 0.85],
  smg: ["soldM", 0.85],
  boss: ["boss", 1.4],
  bloat: ["bloat", 1.15],
  sniper: ["hitman", 0.85],
  shield: ["robot", 0.9],
  stalker: ["stalker", 0.75],
  alpha: ["alpha", 1],
};
const wpnPose = (k: string): CharKey =>
  k === "dmr" || k === "carbine" ? "pSil" : k === "smg" || k === "ar" || k === "sg" || k === "lmg" ? "pMach" : "pGun";

interface Ray extends Pt {
  a: number;
}

/** Visibility polygon from (ox,oy): rays cast at every wall corner (±ε) within the view square. */
function visPoly(r: Raid, ox: number, oy: number): Ray[] {
  const x0 = ox - VR,
    x1 = ox + VR,
    y0 = oy - VR,
    y1 = oy + VR;
  const segs: number[][] = [
    [x0, y0, x1, y0],
    [x1, y0, x1, y1],
    [x1, y1, x0, y1],
    [x0, y1, x0, y0],
  ];
  const pts: number[][] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  for (const w of r.walls) {
    if (w.x > x1 || w.x + w.w < x0 || w.y > y1 || w.y + w.h < y0) continue;
    const a = w.x,
      b = w.y,
      c = w.x + w.w,
      d = w.y + w.h;
    segs.push([a, b, c, b], [c, b, c, d], [c, d, a, d], [a, d, a, b]);
    pts.push([a, b], [c, b], [c, d], [a, d]);
  }
  const out: Ray[] = [];
  for (const [px, py] of pts) {
    const a0 = Math.atan2(py - oy, px - ox);
    for (const a of [a0 - 0.0002, a0, a0 + 0.0002]) {
      const dx = Math.cos(a),
        dy = Math.sin(a);
      let best = Infinity;
      for (const s of segs) {
        const sdx = s[2] - s[0],
          sdy = s[3] - s[1],
          den = dx * sdy - dy * sdx;
        if (Math.abs(den) < 1e-9) continue;
        const qx = s[0] - ox,
          qy = s[1] - oy,
          t = (qx * sdy - qy * sdx) / den,
          u = (qx * dy - qy * dx) / den;
        if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
      }
      if (best < Infinity) out.push({ a, x: ox + dx * best, y: oy + dy * best });
    }
  }
  return out.sort((p, q) => p.a - q.a);
}

function polyPath(g: CanvasRenderingContext2D, poly: Pt[]) {
  g.beginPath();
  poly.forEach((q, i) => {
    if (i) g.lineTo(q.x, q.y);
    else g.moveTo(q.x, q.y);
  });
  g.closePath();
}

function glow(x: number, y: number, r: number, col: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
}

function drawCrate(c: Crate) {
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.fillRect(c.x - 13, c.y - 11, 32, 32);
  tile([20, 4], c.x - 17, c.y - 17, 34);
  if (c.open) {
    ctx.fillStyle = "rgba(10,8,6,.62)";
    ctx.fillRect(c.x - 17, c.y - 17, 34, 34);
  } else {
    ctx.fillStyle = crateCol(c);
    ctx.fillRect(c.x - 17, c.y - 19, 34, 4);
  }
}

const LABEL_R = 130;
/** Names of nearby loot in rarity colour, nudged up so close items don't print over each other. */
function groundLabels(r: Raid) {
  const p = r.p,
    placed: { x: number; y: number; w: number }[] = [];
  const near = r.pick.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < LABEL_R).sort((a, b) => a.y - b.y);
  ctx.font = "600 12px " + FONT;
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,.8)";
  for (const q of near) {
    const t = (upgradeOver(q.it, p.eq) ? "↑ " : "") + nameOf(q.it),
      w = ctx.measureText(t).width + 6;
    let y = q.y - 13;
    while (placed.some((l) => Math.abs(l.y - y) < 13 && Math.abs(l.x - q.x) < (l.w + w) / 2)) y -= 13;
    placed.push({ x: q.x, y, w });
    ctx.globalAlpha = clamp((LABEL_R - Math.hypot(q.x - p.x, q.y - p.y)) / 30, 0, 1);
    ctx.strokeText(t, q.x, y);
    ctx.fillStyle = rarCol(def(q.it.k).r);
    ctx.fillText(t, q.x, y);
  }
  ctx.globalAlpha = 1;
}

/** Held blade, swept through an arc while a strike plays, with a pale trail. */
function drawBlade(x: number, y: number, face: number, reach: number, swing: number) {
  const t = swing > 0 ? 1 - swing / 0.18 : 0.5,
    a = face + (t - 0.5) * 2 * MELEE_ARC,
    len = 10 + reach * 0.35;
  const hx = x + Math.cos(face) * 13 + Math.cos(face + 1.57) * 5,
    hy = y + Math.sin(face) * 13 + Math.sin(face + 1.57) * 5;
  if (swing > 0) {
    ctx.strokeStyle = "rgba(235,240,245,.6)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(x, y, 14 + len, face - MELEE_ARC, a);
    ctx.stroke();
  }
  ctx.strokeStyle = "#d9dde2";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(a) * len, hy + Math.sin(a) * len);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function ring(x: number, y: number, f: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 24, -1.57, -1.57 + 6.28 * f);
  ctx.stroke();
}

export function draw(r: Raid | null) {
  const { dpr, vw, vh, zoom } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!r) return;
  VR = BASE_VR * (1 + r.p.st.vis);
  const p = r.p,
    sx = r.shake > 0 ? rnd(-4, 4) : 0,
    sy = r.shake > 0 ? rnd(-4, 4) : 0;
  const cx = p.x - vw / 2 / zoom + sx,
    cy = p.y - vh / 2 / zoom + sy,
    k = dpr * zoom,
    ww = vw / zoom,
    wh = vh / zoom;
  const tt = performance.now() / 1000;
  const world = (g: CanvasRenderingContext2D) => g.setTransform(k, 0, 0, k, -cx * k, -cy * k);
  const poly = visPoly(r, p.x, p.y),
    seen = (o: Pt) => Math.hypot(o.x - p.x, o.y - p.y) < VR && los(r.walls, p, o);
  const near = r.walls.filter((w) => w.x < cx + ww + 20 && w.x + w.w > cx - 20 && w.y < cy + wh + 20 && w.y + w.h > cy - 20);
  const inView = (x: number, y: number, m = 60) => x > cx - m && x < cx + ww + m && y > cy - m && y < cy + wh + m;

  // ground, floors, stains, decor
  world(ctx);
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
  const sx0 = clamp(cx, 0, W),
    sy0 = clamp(cy, 0, H),
    sx1 = clamp(cx + ww, 0, W),
    sy1 = clamp(cy + wh, 0, H);
  if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(r.decal.c, sx0 / 2, sy0 / 2, (sx1 - sx0) / 2, (sy1 - sy0) / 2, sx0, sy0, sx1 - sx0, sy1 - sy0);
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

  // things on the ground, then actors
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
  // view cones of the enemies that haven't spotted the player, warming up as they grow suspicious
  for (const e of r.enemies) {
    if (e.aggro || e.kind === "stalker" || !seen(e)) continue;
    const { range, half } = sight(e, p);
    ctx.fillStyle = `rgba(255,${Math.round(235 - 165 * e.sus)},${Math.round(190 - 150 * e.sus)},${(0.11 + 0.16 * e.sus).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    for (let i = 0; i <= 14; i++) {
      const a = e.fa - half + (2 * half * i) / 14,
        dx = Math.cos(a),
        dy = Math.sin(a),
        l = rayLen(r.walls, e.x, e.y, dx, dy, range);
      ctx.lineTo(e.x + dx * l, e.y + dy * l);
    }
    ctx.closePath();
    ctx.fill();
  }
  for (const e of r.enemies) {
    if (!seen(e)) continue;
    const a = Math.atan2(p.y - e.y, p.x - e.x),
      [look, scale] = LOOK[e.kind];
    // a stalker only shows when it charges, or as a shimmer up close
    const hidden = e.kind === "stalker" && e.ph !== 1 && e.hit <= 0;
    if (hidden && Math.hypot(e.x - p.x, e.y - p.y) > 150) continue;
    ctx.globalAlpha = hidden ? 0.18 : 1;
    if (e.kind === "alpha") glow(e.x, e.y, 46, C.bad, 0.35 + 0.1 * Math.sin(performance.now() / 150));
    // a lit fuse flashes white faster and faster
    const fuse = e.kind === "bloat" && e.ph > 0 && Math.sin(e.t * (10 + e.t * 40)) > 0;
    sprite(look, e.x, e.y, e.aggro ? a : e.fa, e.hit > 0 || fuse, scale);
    ctx.globalAlpha = 1;
    if (e.kind === "shield") {
      ctx.strokeStyle = "#cfe3f2";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, KINDS.shield.r + 7, a - 1.05, a + 1.05);
      ctx.stroke();
    }
    if (e.hp < e.max && e.kind !== "boss") {
      const bw = KINDS[e.kind].r * 2 + 2;
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(e.x - bw / 2, e.y + 20, bw, 4);
      ctx.fillStyle = C.bad;
      ctx.fillRect(e.x - bw / 2, e.y + 20, (bw * e.hp) / e.max, 4);
    }
  }
  if (p.eq.body) {
    ctx.strokeStyle = C.r2;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, 6.28);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // the gun stays in hand; the blade comes out for a swing, or for good with no gun
  const gun = p.swing > 0 ? null : p.eq.gun;
  sprite(gun ? wpnPose(gun.k) : "pHold", p.x, p.y, p.face, p.hit > 0);
  if (!gun) drawBlade(p.x, p.y, p.face, wstat(bladeOf(p)).range, p.swing);
  for (const q of r.parts)
    if (!q.glow) {
      ctx.globalAlpha = clamp(q.life * 3, 0, 1);
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(12,16,34,.3)";
  ctx.fillRect(cx, cy, ww, wh);

  // darkness: everything outside the line of sight
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.globalCompositeOperation = "source-over";
  sg.fillStyle = "rgba(4,5,7,.9)";
  sg.fillRect(0, 0, shade.width, shade.height);
  world(sg);
  sg.globalCompositeOperation = "destination-out";
  const lg = sg.createRadialGradient(p.x, p.y, VR * 0.3, p.x, p.y, VR);
  lg.addColorStop(0, "rgba(0,0,0,1)");
  lg.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = lg;
  polyPath(sg, poly);
  sg.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(shade, 0, 0);
  world(ctx);

  // walls stay visible above the darkness, dimmer with distance
  const dg = ctx.createRadialGradient(p.x, p.y, 40, p.x, p.y, VR * 1.15);
  dg.addColorStop(0, "rgba(0,0,0,0)");
  dg.addColorStop(1, "rgba(0,0,0,.78)");
  const locks = new Set(r.vault && !r.vault.open ? r.vault.locks : []);
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

  for (const l of locks) {
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

  // light sources
  ctx.globalCompositeOperation = "lighter";
  for (const l of locks) glow(lockCentre(l).x, lockCentre(l).y, 70, GOLD, 0.25 + 0.08 * Math.sin(tt * 2.5));
  for (const e of r.exits) glow(e.x, e.y, 130, C.ok, 0.32 + 0.1 * Math.sin(tt * 3));
  for (const c of r.crates) if (!c.open && c.d > 0.36) glow(c.x, c.y, 46, crateCol(c), 0.2 + 0.08 * Math.sin(tt * 2 + c.x));
  for (const q of r.pick) {
    const rr = def(q.it.k).r,
      col = rarCol(rr);
    glow(q.x, q.y, 22, col, 0.45);
    // rare and epic loot sends a light beam up through the darkness
    if (rr >= 2 && inView(q.x, q.y, 400)) {
      const bg = ctx.createLinearGradient(q.x, q.y, q.x, q.y - 320);
      bg.addColorStop(0, col);
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(tt * 4 + q.x);
      ctx.fillStyle = bg;
      ctx.fillRect(q.x - (rr === 3 ? 7 : 5), q.y - 320, rr === 3 ? 14 : 10, 320);
      ctx.globalAlpha = 1;
    }
  }
  if (r.flash > 0) {
    ctx.save();
    polyPath(ctx, poly);
    ctx.clip();
    glow(p.x + Math.cos(p.face) * 20, p.y + Math.sin(p.face) * 20, 260, "rgba(255,176,80,1)", (0.5 * r.flash) / 0.07);
    ctx.restore();
  }
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
    glow(b.x, b.y, 16, C.enemy2, 0.8);
    ctx.fillStyle = "#ffd0a0";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, 6.28);
    ctx.fill();
  }
  for (const q of r.parts)
    if (q.glow) {
      ctx.globalAlpha = clamp(q.life * 3, 0, 1);
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "butt";

  // markers
  for (const e of r.exits) {
    ctx.strokeStyle = C.ok;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -tt * 20;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 62, 0, 6.28);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.ok;
    ctx.font = "600 14px " + FONT;
    ctx.textAlign = "center";
    ctx.fillText("SORTIE", e.x, e.y + 5);
  }
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  for (const e of r.enemies)
    if (seen(e) && (e.aggro || (suspicious(e) && e.kind !== "stalker"))) {
      ctx.fillStyle = e.aggro ? C.bad : C.accent;
      ctx.strokeStyle = "rgba(0,0,0,.7)";
      ctx.font = `800 ${20 + 14 * clamp(e.al / ALERT_POP, 0, 1)}px ` + FONT;
      ctx.strokeText(e.aggro ? "!" : "?", e.x, e.y - 24);
      ctx.fillText(e.aggro ? "!" : "?", e.x, e.y - 24);
    }
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,.7)";
  for (const n of r.nums) {
    ctx.globalAlpha = clamp(n.life * 2, 0, 1);
    ctx.font = (n.big ? "700 17px " : "600 13px ") + FONT;
    ctx.strokeText(String(n.v), n.x, n.y);
    ctx.fillStyle = n.big ? "#ffe2a8" : C.fg;
    ctx.fillText(String(n.v), n.x, n.y);
  }
  ctx.globalAlpha = 1;
  groundLabels(r);
  for (const c of r.crates) if (!c.open && c.prog > 0) ring(c.x, c.y, c.prog / CRATE_TIME, C.accent);
  if (r.vault && !r.vault.open)
    for (const l of r.vault.locks) {
      const m = lockCentre(l),
        d = Math.hypot(m.x - p.x, m.y - p.y);
      if (r.vault.prog > 0 && d < 64) ring(m.x, m.y, r.vault.prog / UNLOCK_TIME, GOLD);
      if (d < 140) {
        ctx.fillStyle = GOLD;
        ctx.font = "600 13px " + FONT;
        ctx.textAlign = "center";
        ctx.fillText(hasKey(r) ? "SALLE FORTE · reste immobile" : "SALLE FORTE · clé requise", m.x, m.y - 30);
      }
    }
  if (r.ext > 0) {
    ring(p.x, p.y, r.ext / EXTRACT_TIME, C.ok);
    ctx.fillStyle = C.ok;
    ctx.textAlign = "center";
    ctx.font = "600 15px " + FONT;
    ctx.fillText("EXTRACTION " + Math.ceil(EXTRACT_TIME - r.ext), p.x, p.y - 34);
  }

  // screen-space overlays: vignette (red when hurt), exit arrows, joystick
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const low = p.hp / p.max < 0.35,
    hurtA = Math.max(p.hit > 0 ? 0.5 : 0, low ? 0.25 + 0.15 * Math.sin(tt * 5) : 0);
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, hurtA ? `rgba(120,10,10,${hurtA.toFixed(2)})` : "rgba(0,0,0,.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);
  const boss = r.enemies.find((e) => e.kind === "boss" && e.aggro && seen(e));
  if (boss) {
    const bw = Math.min(320, vw - 32),
      bx = (vw - bw) / 2,
      by = 100;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = C.bad;
    ctx.fillRect(bx, by, (bw * boss.hp) / boss.max, 8);
    ctx.fillStyle = C.fg;
    ctx.font = "600 13px " + FONT;
    ctx.textAlign = "center";
    ctx.fillText("LA BRUTE", vw / 2, by - 5);
  }
  const top = boss ? 120 : 60,
    bot = vh - 90;
  for (const e of r.exits) {
    const ex = (e.x - cx) * zoom,
      ey = (e.y - cy) * zoom;
    if (ex > 0 && ex < vw && ey > top && ey < bot) continue;
    const a = Math.atan2(ey - vh / 2, ex - vw / 2);
    const hx = clamp(vw / 2 + Math.cos(a) * vw, 28, vw - 28),
      hy = clamp(vh / 2 + Math.sin(a) * vh, top + 20, bot);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    ctx.fillStyle = C.ok;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.ok;
    ctx.font = "600 12px " + FONT;
    ctx.textAlign = "center";
    ctx.fillText(fmtM(Math.hypot(e.x - p.x, e.y - p.y)), hx - Math.cos(a) * 30, hy - Math.sin(a) * 22 + 4);
  }
  if (stick && mode === "raid") {
    const m = moveVec();
    ctx.strokeStyle = C.fg;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stick.bx, stick.by, STICK_R, 0, 6.28);
    ctx.stroke();
    ctx.fillStyle = C.fg;
    ctx.beginPath();
    ctx.arc(stick.bx + m.x * STICK_R, stick.by + m.y * STICK_R, 22, 0, 6.28);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (r.dead > 0) {
    const f = clamp(1 - r.dead / DEATH_TIME, 0, 1),
      dead = r.why.startsWith("Tu");
    ctx.fillStyle = `rgba(60,0,0,${(0.75 * f).toFixed(2)})`;
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalAlpha = clamp(f * 2.5, 0, 1);
    ctx.textAlign = "center";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,.8)";
    ctx.fillStyle = C.bad;
    ctx.font = `800 ${Math.round(38 + 10 * f)}px ` + FONT;
    ctx.strokeText(dead ? "TU ES MORT" : "ZONE VERROUILLÉE", vw / 2, vh * 0.42);
    ctx.fillText(dead ? "TU ES MORT" : "ZONE VERROUILLÉE", vw / 2, vh * 0.42);
    ctx.fillStyle = C.fg;
    ctx.font = "600 15px " + FONT;
    ctx.fillText("Tout ce que tu portais est perdu", vw / 2, vh * 0.42 + 40);
    ctx.globalAlpha = 1;
  }
}
