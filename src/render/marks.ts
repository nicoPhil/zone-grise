import { ALERT_POP, suspicious } from "../aware";
import { def, nameOf, upgradeOver } from "../items";
import { EXTRACT_TIME, UNLOCK_TIME, crateTime, hasKey, lockCentre, type Raid } from "../raid";
import { clamp } from "../util";
import { C, FONT, ctx, rarCol } from "./canvas";
import { GOLD, ring, type Frame } from "./frame";

function exitMarks({ r, tt }: Frame) {
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
}

/** "!" over enemies hunting the player, "?" over the suspicious ones. */
function alerts({ r, seen }: Frame) {
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
}

function damageNums(r: Raid) {
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

function vaultHints(r: Raid) {
  const { p, vault } = r;
  if (!vault || vault.open) return;
  for (const l of vault.locks) {
    const m = lockCentre(l),
      d = Math.hypot(m.x - p.x, m.y - p.y);
    if (vault.prog > 0 && d < 64) ring(m, vault.prog / UNLOCK_TIME, GOLD);
    if (d < 140) {
      ctx.fillStyle = GOLD;
      ctx.font = "600 13px " + FONT;
      ctx.textAlign = "center";
      ctx.fillText(hasKey(r) ? "SALLE FORTE · reste immobile" : "SALLE FORTE · clé requise", m.x, m.y - 30);
    }
  }
}

/** Progress rings: crates being searched, the vault being unlocked, the extraction countdown. */
function progress(r: Raid) {
  const p = r.p;
  for (const c of r.crates) if (!c.open && c.prog > 0) ring(c, c.prog / crateTime(c), C.accent);
  vaultHints(r);
  if (r.ext > 0) {
    ring(p, r.ext / EXTRACT_TIME, C.ok);
    ctx.fillStyle = C.ok;
    ctx.textAlign = "center";
    ctx.font = "600 15px " + FONT;
    ctx.fillText("EXTRACTION " + Math.ceil(EXTRACT_TIME - r.ext), p.x, p.y - 34);
  }
}

/** World-space markers drawn over the darkness. */
export function markers(f: Frame) {
  exitMarks(f);
  alerts(f);
  damageNums(f.r);
  groundLabels(f.r);
  progress(f.r);
}
