import { bagUsed, def, nameOf, slotOf, upgradeOver, type Item, type Slot } from "../items";
import { R, drop, equip, ground, rcap, setSlot, useItem } from "../raid";
import { sheet } from "./sheet";
import { setMode } from "../state";
import { clearStick } from "../input";
import { $ } from "../util";
import { toast, updHud } from "./hud";
import { icon } from "./icons";
import { pin, popup } from "./popup";

type Where = "bag" | "ground" | "eq";
const DANGER_R = 500;
/** Item whose detail popup is open. */
let detail: string | null = null;
/** Shake the bag grid on the next render: the player tried to take something that doesn't fit. */
let full = false;

export function openBag() {
  if (!R || R.dead > 0) return;
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

function tile(it: Item, where: "bag" | "ground") {
  const d = def(it.k), up = R && upgradeOver(it, R.p.eq);
  const move = where === "bag" ? ["drop", "Poser"] : ["take", "Prendre"];
  return `<div class="tile" role="button" tabindex="0" data-pin="${it.u}" style="grid-column:span ${d.s};--rc:var(--r${d.r})" data-u="${it.u}" aria-pressed="${detail === it.u}">
    <b>${nameOf(it)}</b>${up ? `<i class="up" aria-label="mieux que ton équipement">↑</i>` : ""}
    <button class="mv" data-a="${move[0]}" data-u="${it.u}" aria-label="${move[1]}">${icon(move[0] as "drop" | "take")}</button></div>`;
}

function findItem(u: string): { it: Item; where: Where } | null {
  if (!R) return null;
  const p = R.p, b = R.bag.find((i) => i.u === u), g = ground(R).find((k) => k.it.u === u);
  if (b) return { it: b, where: "bag" };
  if (g) return { it: g.it, where: "ground" };
  const e = Object.values(p.eq).find((i) => i?.u === u);
  return e ? { it: e, where: "eq" } : null;
}

function detailPanel() {
  const f = detail ? findItem(detail) : null;
  if (!f) return "";
  const { it, where } = f, t = def(it.k).t;
  return popup(it, where === "eq" ? ["équipé"] : [], [
    where !== "eq" && (t === "wpn" || t === "gear") ? `<button data-a="eq">${icon("equip")}Équiper</button>` : "",
    where === "eq" ? `<button data-a="unequip">${icon("unequip")}Retirer</button>` : "",
    where === "bag" && (t === "med" || t === "stim") ? `<button data-a="use">${icon("use")}Utiliser</button>` : "",
  ], false);
}

function renderBag() {
  if (!R) return;
  const r = R, p = r.p, used = bagUsed(r.bag);
  const free = Array.from({ length: Math.max(0, rcap(r) - used) }, () => `<div class="cell" aria-hidden="true"></div>`).join("");
  const near = ground(r);
  $("bag").innerHTML = `<div class="dismiss" data-a="back" aria-hidden="true"></div><div class="wrap">
    <div class="top"><h2>Sac ${used} / ${rcap(r)}</h2></div>
    <div id="bagLive" class="live"></div>
    ${detailPanel()}
    <div class="card"><div class="lbl">Sac</div><div class="grid${full ? " full" : ""}">${r.bag.map((i) => tile(i, "bag")).join("")}${free}</div></div>
    <div class="card"><div class="lbl">Au sol</div>
      ${near.length ? `<div class="grid">${near.map((k) => tile(k.it, "ground")).join("")}</div>` : `<p class="empty">Rien à tes pieds.</p>`}</div>
    <div class="card"><div class="lbl">Personnage · touche un emplacement</div>${sheet(p.eq, { st: p.st, hp: p.max, cap: rcap(r), sel: detail })}</div>
    <p class="note">Touche un objet pour ses détails · ${icon("drop")} poser · ${icon("take")} prendre. Le raid continue pendant le tri : tu n'es pas repéré, mais ceux qui te chassent déjà arrivent.</p>
    <button class="go" data-a="back">Reprendre</button></div>`;
  full = false;
  tickBag();
  pin($("bag"));
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

/** Bag → ground or ground → bag. */
function move(u: string) {
  const r = R, f = findItem(u);
  if (!r || !f || f.where === "eq") return;
  detail = null;
  if (f.where === "bag") {
    r.bag.splice(r.bag.indexOf(f.it), 1);
    drop(r, f.it);
  } else if (bagUsed(r.bag) + def(f.it.k).s <= rcap(r)) {
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
    if (old && f.where === "bag" && bagUsed(r.bag) + def(old.k).s <= rcap(r)) r.bag.push(old);
    else if (old) drop(r, old);
  }
  if (a === "unequip") {
    setSlot(r, slotOf(f.it)!, null);
    if (bagUsed(r.bag) + def(f.it.k).s <= rcap(r)) r.bag.push(f.it);
    else drop(r, f.it);
  }
  detail = null;
}

export function initBag() {
  const el = $("bag");
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("scroll", () => pin(el), { passive: true });
  el.addEventListener("click", (e) => {
    const t = e.target as HTMLElement, b = t.closest<HTMLElement>("button, .scrim, .dismiss"), card = t.closest<HTMLElement>(".tile");
    if (!R) return;
    const a = b?.dataset.a;
    if (a === "back") return closeBag();
    if (a === "close") detail = null;
    else if (a === "drop" || a === "take") move(b!.dataset.u!);
    else if (a) act(a);
    else if (card) detail = detail === card.dataset.u ? null : card.dataset.u!;
    else if (b?.dataset.slot) {
      const it = R.p.eq[b.dataset.slot as Slot];
      detail = it && detail !== it.u ? it.u : null;
    } else return;
    updHud(R);
    renderBag();
  });
}
