import { bagUsed, def, desc, nameOf, upgradeOver, valOf, type Item } from "../items";
import { cap } from "../progression";
import { R, drop, equip, ground, useItem } from "../raid";
import { setMode } from "../state";
import { clearStick } from "../input";
import { $ } from "../util";
import { toast, updHud } from "./hud";

type Where = "bag" | "ground" | "eq";
const LONG_PRESS = 450;
const DANGER_R = 500;
/** Item whose detail panel is open (long press). */
let detail: string | null = null;
/** Shake the bag grid on the next render: the player tried to take something that doesn't fit. */
let full = false;

export function openBag() {
  if (!R) return;
  setMode("bag");
  clearStick();
  detail = null;
  renderBag();
  $("bag").hidden = false;
}

export function closeBag() {
  $("bag").hidden = true;
  setMode("raid");
}

const perSlot = (it: Item) => Math.round(valOf(it) / def(it.k).s);

function tile(it: Item, where: Where) {
  const d = def(it.k), up = where !== "eq" && R && upgradeOver(it, R.p);
  return `<button class="tile" style="grid-column:span ${d.s};--rc:var(--r${d.r})" data-w="${where}" data-u="${it.u}" aria-pressed="${detail === it.u}">
    <b>${nameOf(it)}</b><small>${where === "eq" ? "équipé" : perSlot(it) + " cr/pl"}</small>${up ? `<i class="up" aria-label="mieux que ton équipement">↑</i>` : ""}</button>`;
}

function findItem(u: string): { it: Item; where: Where } | null {
  if (!R) return null;
  const p = R.p, b = R.bag.find((i) => i.u === u), g = ground(R).find((k) => k.it.u === u);
  if (b) return { it: b, where: "bag" };
  if (g) return { it: g.it, where: "ground" };
  const e = [p.wpn, p.mel, p.arm].find((i) => i?.u === u);
  return e ? { it: e, where: "eq" } : null;
}

function detailPanel() {
  const f = detail ? findItem(detail) : null;
  if (!f) return "";
  const { it, where } = f, t = def(it.k).t;
  const btns = [
    where !== "eq" && (t === "wpn" || t === "arm") ? `<button data-a="eq">Équiper</button>` : "",
    where === "bag" && (t === "med" || t === "stim") ? `<button data-a="use">Utiliser</button>` : "",
    `<button data-a="close">Fermer</button>`,
  ];
  return `<div class="card detail"><b style="color:var(--r${def(it.k).r})">${nameOf(it)}</b>
    <small>${desc(it)} · ${def(it.k).s} place${def(it.k).s > 1 ? "s" : ""} · ${valOf(it)} cr</small><div class="btns">${btns.join("")}</div></div>`;
}

function renderBag() {
  if (!R) return;
  const r = R, p = r.p, used = bagUsed(r.bag), val = r.bag.reduce((s, i) => s + valOf(i), 0);
  const free = Array.from({ length: Math.max(0, cap() - used) }, () => `<div class="cell" aria-hidden="true"></div>`).join("");
  const near = ground(r);
  $("bag").innerHTML = `<div class="wrap">
    <div class="top"><h2>Sac ${used} / ${cap()}</h2><div class="val">${val} cr</div></div>
    <div id="bagLive" class="live"></div>
    ${detailPanel()}
    <div class="card"><div class="lbl">Sac · touche pour poser</div><div class="grid${full ? " full" : ""}">${r.bag.map((i) => tile(i, "bag")).join("")}${free}</div></div>
    <div class="card"><div class="lbl">Au sol · touche pour prendre</div>
      ${near.length ? `<div class="grid">${near.map((k) => tile(k.it, "ground")).join("")}</div>` : `<p class="empty">Rien à tes pieds.</p>`}</div>
    <div class="card"><div class="lbl">Équipé</div><div class="grid">${[p.wpn, p.mel, p.arm].filter((i): i is Item => !!i).map((i) => tile(i, "eq")).join("")}</div></div>
    <p class="note">Appui long sur un objet : détails et équiper. Le raid continue pendant le tri : tu n'es pas repéré, mais ceux qui te chassent déjà arrivent.</p>
    <button class="go" data-a="back">Reprendre</button></div>`;
  full = false;
  tickBag();
}

/** Per-frame refresh of what changes without the player touching the bag: health and danger. */
export function tickBag() {
  const el = document.getElementById("bagLive");
  if (!R || !el) return;
  const p = R.p, hunted = R.enemies.some((e) => e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < DANGER_R);
  const txt = `${Math.ceil(Math.max(0, p.hp))} / ${p.max} PV` + (hunted ? " · ennemi en approche" : "");
  if (el.textContent !== txt) {
    el.textContent = txt;
    el.classList.toggle("danger", hunted);
  }
}

function tap(u: string) {
  const r = R, f = findItem(u);
  if (!r || !f) return;
  if (f.where === "eq") {
    detail = detail === u ? null : u;
    return;
  }
  detail = null;
  if (f.where === "bag") {
    r.bag.splice(r.bag.indexOf(f.it), 1);
    drop(r, f.it);
  } else if (bagUsed(r.bag) + def(f.it.k).s <= cap()) {
    r.pick.splice(r.pick.findIndex((k) => k.it === f.it), 1);
    r.bag.push(f.it);
  } else {
    toast("Pas la place : pose d'abord un objet du sac");
    full = true;
  }
}

function act(a: string) {
  const r = R, f = detail ? findItem(detail) : null;
  if (!r || !f) return;
  if (a === "use") useItem(f.it);
  if (a === "eq") {
    if (f.where === "bag") r.bag.splice(r.bag.indexOf(f.it), 1);
    else r.pick.splice(r.pick.findIndex((k) => k.it === f.it), 1);
    const old = equip(r, f.it);
    // the replaced piece goes where the new one came from, or to the ground when the bag can't hold it
    if (old && f.where === "bag" && bagUsed(r.bag) + def(old.k).s <= cap()) r.bag.push(old);
    else if (old) drop(r, old);
  }
  detail = null;
}

export function initBag() {
  const el = $("bag");
  let timer = 0, longFired = false;
  el.addEventListener("pointerdown", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>(".tile");
    longFired = false;
    clearTimeout(timer);
    if (!t) return;
    timer = window.setTimeout(() => {
      longFired = true;
      detail = t.dataset.u!;
      renderBag();
    }, LONG_PRESS);
  });
  const cancel = () => clearTimeout(timer);
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || !R || longFired) return;
    const a = b.dataset.a;
    if (a === "back") return closeBag();
    if (a === "close") detail = null;
    else if (a) act(a);
    else if (b.dataset.u) tap(b.dataset.u);
    updHud(R);
    renderBag();
  });
}
