import { STICK_R, moveVec, stick } from "../input";
import { DEATH_TIME, type Enemy, type Raid } from "../raid";
import { mode } from "../state";
import { clamp, fmtM, type Pt } from "../util";
import { H, W } from "../world/mapgen";
import { CORE } from "../world/rings";
import { C, FONT, ctx, view } from "./canvas";
import type { Frame } from "./frame";

/** Darkened screen edges, red when hurt. */
function vignette({ p, tt }: Frame) {
  const { vw, vh } = view;
  const low = p.hp / p.max < 0.35,
    hurtA = Math.max(p.hit > 0 ? 0.5 : 0, low ? 0.25 + 0.15 * Math.sin(tt * 5) : 0);
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, hurtA ? `rgba(120,10,10,${hurtA.toFixed(2)})` : "rgba(0,0,0,.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);
}

function bossBar(boss: Enemy) {
  const { vw } = view;
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

/** Where on the screen edge to point at `to`, kept clear of the HUD above `top`; null when `to` is on screen. */
function edgeSpot({ cx, cy }: Frame, to: Pt, top: number) {
  const { vw, vh, zoom } = view;
  const bot = vh - 90;
  const ex = (to.x - cx) * zoom,
    ey = (to.y - cy) * zoom;
  if (ex > 0 && ex < vw && ey > top && ey < bot) return null;
  const a = Math.atan2(ey - vh / 2, ex - vw / 2);
  return { a, x: clamp(vw / 2 + Math.cos(a) * vw, 28, vw - 28), y: clamp(vh / 2 + Math.sin(a) * vh, top + 20, bot) };
}

/** An arrow at the screen edge with the distance to its target. */
function edgeArrow({ p }: Frame, to: Pt, at: Pt & { a: number }, col: string) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(at.a);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-8, 9);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = col;
  ctx.font = "600 12px " + FONT;
  ctx.textAlign = "center";
  ctx.fillText(fmtM(Math.hypot(to.x - p.x, to.y - p.y)), at.x - Math.cos(at.a) * 30, at.y - Math.sin(at.a) * 22 + 4);
}

/** Exits in green; the way to the Cœur in amber until the player is in it, slid along the edge off an exit arrow. */
function arrows(f: Frame, top: number) {
  const taken: Pt[] = [];
  for (const e of f.r.exits) {
    const at = edgeSpot(f, e, top);
    if (!at) continue;
    edgeArrow(f, e, at, C.ok);
    taken.push(at);
  }
  const centre = { x: W / 2, y: H / 2 },
    at = f.r.ring === CORE ? null : edgeSpot(f, centre, top);
  if (at) edgeArrow(f, centre, clearOf(at, taken), C.accent);
}

/** Slides an edge spot towards the middle of its side until it is clear of the taken ones. */
function clearOf<T extends Pt>(at: T, taken: Pt[]): T {
  const side = at.x <= 28 || at.x >= view.vw - 28,
    step = (v: number, mid: number) => (v > mid ? -44 : 44);
  for (let i = 0; i < 4 && taken.some((t) => Math.hypot(t.x - at.x, t.y - at.y) < 44); i++)
    if (side) at.y += step(at.y, view.vh / 2);
    else at.x += step(at.x, view.vw / 2);
  return at;
}

function joystick() {
  if (!stick || mode !== "raid") return;
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

function deathScreen(r: Raid) {
  const { vw, vh } = view;
  const f = clamp(1 - r.dead / DEATH_TIME, 0, 1),
    title = r.why.startsWith("Tu") ? "TU ES MORT" : "ZONE VERROUILLÉE";
  ctx.fillStyle = `rgba(60,0,0,${(0.75 * f).toFixed(2)})`;
  ctx.fillRect(0, 0, vw, vh);
  ctx.globalAlpha = clamp(f * 2.5, 0, 1);
  ctx.textAlign = "center";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,.8)";
  ctx.fillStyle = C.bad;
  ctx.font = `800 ${Math.round(38 + 10 * f)}px ` + FONT;
  ctx.strokeText(title, vw / 2, vh * 0.42);
  ctx.fillText(title, vw / 2, vh * 0.42);
  ctx.fillStyle = C.fg;
  ctx.font = "600 15px " + FONT;
  ctx.fillText("Tout ce que tu portais est perdu", vw / 2, vh * 0.42 + 40);
  ctx.globalAlpha = 1;
}

/** Screen-space overlays: vignette, boss bar, exit and centre arrows, joystick, death screen. */
export function overlay(f: Frame) {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  vignette(f);
  const boss = f.r.enemies.find((e) => e.kind === "boss" && e.aggro && f.seen(e));
  if (boss) bossBar(boss);
  arrows(f, boss ? 120 : 60);
  joystick();
  if (f.r.dead > 0) deathScreen(f.r);
}
