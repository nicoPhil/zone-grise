import { wstat } from "../items";
import { KINDS, bladeOf, sight, type Enemy, type Kind, type Shield } from "../raid";
import type { Pt } from "../util";
import { MELEE_ARC, rayLen } from "../world/geometry";
import { sprite, type CharKey } from "./assets";
import { C, ctx } from "./canvas";
import { glow, particles, type Frame } from "./frame";

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
const MACHINE = ["smg", "ar", "sg", "lmg"];

function wpnPose(k: string): CharKey {
  if (k === "dmr" || k === "carbine") return "pSil";
  return MACHINE.includes(k) ? "pMach" : "pGun";
}

/** View cones of the enemies that haven't spotted the player, warming up as they grow suspicious. */
function viewCones({ r, p, seen }: Frame) {
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
        l = rayLen(r.walls, e, { x: dx, y: dy }, range);
      ctx.lineTo(e.x + dx * l, e.y + dy * l);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawEnemy({ p }: Frame, e: Enemy) {
  const a = Math.atan2(p.y - e.y, p.x - e.x),
    [look, scale] = LOOK[e.kind];
  // a stalker only shows when it charges, or as a shimmer up close
  const hidden = e.kind === "stalker" && e.ph !== 1 && e.hit <= 0;
  if (hidden && Math.hypot(e.x - p.x, e.y - p.y) > 150) return;
  ctx.globalAlpha = hidden ? 0.18 : 1;
  if (e.kind === "alpha") glow(e, 46, C.bad, 0.35 + 0.1 * Math.sin(performance.now() / 150));
  // a lit fuse flashes white faster and faster
  const fuse = e.kind === "bloat" && e.ph > 0 && Math.sin(e.t * (10 + e.t * 40)) > 0;
  sprite(look, { x: e.x, y: e.y, a: e.aggro ? a : e.fa }, e.hit > 0 || fuse, scale);
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

/** Held blade, swept through an arc while a strike plays, with a pale trail. */
function drawBlade({ x, y }: Pt, face: number, reach: number, swing: number) {
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

/** Blue ring as strong as the reserve, brighter on impact, bursting outwards when it breaks. */
function shieldRing({ x, y }: Pt, sh: Shield | null) {
  if (!sh) return;
  ctx.strokeStyle = C.shield;
  if (sh.broke > 0) {
    const f = sh.broke / 0.4;
    ctx.globalAlpha = f;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 21 + 26 * (1 - f), 0, 6.28);
    ctx.stroke();
  }
  if (sh.left > 0) {
    ctx.globalAlpha = sh.flash > 0 ? 1 : 0.2 + 0.6 * (sh.left / sh.pts);
    ctx.lineWidth = sh.flash > 0 ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 21, 0, 6.28);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer({ p }: Frame) {
  shieldRing(p, p.sh);
  // the gun stays in hand; the blade comes out for a swing, or for good with no gun
  const gun = p.swing > 0 ? null : p.eq.gun;
  sprite(gun ? wpnPose(gun.k) : "pHold", { x: p.x, y: p.y, a: p.face }, p.hit > 0);
  if (!gun) drawBlade(p, p.face, wstat(bladeOf(p)).range, p.swing);
}

/** Enemies, the player and the dust they kick up, under the night tint. */
export function actors(f: Frame) {
  viewCones(f);
  for (const e of f.r.enemies) if (f.seen(e)) drawEnemy(f, e);
  drawPlayer(f);
  particles(f.r, false);
  ctx.fillStyle = "rgba(12,16,34,.3)";
  ctx.fillRect(f.cx, f.cy, f.ww, f.wh);
}
