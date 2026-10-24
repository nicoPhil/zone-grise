import { bagUsed, def, desc, nameOf, valOf } from "../items";
import { cap } from "../progression";
import { R, clock, drop, equip, ground, useItem } from "../raid";
import { setMode } from "../state";
import { clearStick } from "../input";
import { $ } from "../util";
import { updHud } from "./hud";
import { row } from "./row";

export function openBag() {
  if (!R) return;
  setMode("bag");
  clearStick();
  renderBag();
  $("bag").hidden = false;
}

export function closeBag() {
  $("bag").hidden = true;
  setMode("raid");
  clock.last = performance.now();
}

/** Ground item picked for a swap while the bag is full: the bag rows then offer to put something down for it. */
let swapFor: string | null = null;

function renderBag() {
  if (!R) return;
  const r = R, p = r.p, val = r.bag.reduce((s, i) => s + valOf(i), 0), free = cap() - bagUsed(r.bag);
  const near = ground(r), sel = near.find((k) => k.it.u === swapFor)?.it;
  if (!sel) swapFor = null;
  const gear = (t: string) => t === "wpn" || t === "arm";
  const items = r.bag.map((i) => {
    const d = def(i.k);
    if (sel) {
      const fits = free + d.s >= def(sel.k).s;
      return row(i, `<div class="btns"><button data-a="swap" data-u="${i.u}" ${fits ? "" : "disabled"}>Poser</button></div>`, `${d.s} place${d.s > 1 ? "s" : ""} · ${valOf(i)} cr`);
    }
    const btns = `<div class="btns">${gear(d.t) ? `<button data-a="eq" data-u="${i.u}">Équiper</button>` : ""}${d.t === "med" || d.t === "stim" ? `<button data-a="use" data-u="${i.u}">Utiliser</button>` : ""}<button data-a="drop" data-u="${i.u}">Jeter</button></div>`;
    return row(i, btns, `${desc(i)} · ${d.s} place${d.s > 1 ? "s" : ""} · ${valOf(i)} cr`);
  });
  const floor = near.map(({ it }) => {
    const d = def(it.k), fits = d.s <= free;
    const take = fits ? `<button data-a="take" data-u="${it.u}">Prendre</button>` : `<button data-a="pick" data-u="${it.u}" aria-pressed="${it === sel}">Échanger</button>`;
    return row(it, `<div class="btns">${gear(d.t) ? `<button data-a="geq" data-u="${it.u}">Équiper</button>` : ""}${take}</div>`, `${desc(it)} · ${d.s} place${d.s > 1 ? "s" : ""} · ${valOf(it)} cr`);
  });
  $("bag").innerHTML = `<div class="wrap">
    <div class="top"><h2>Sac ${bagUsed(r.bag)} / ${cap()}</h2><div class="val">${val} cr</div></div>
    ${floor.length ? `<div class="card"><div class="lbl">Au sol</div>${floor.join("")}</div>` : ""}
    ${sel ? `<p class="note swap"><span>Choisis ce que tu poses pour prendre <b>${nameOf(sel)}</b>.</span><button data-a="cancel">Annuler</button></p>` : ""}
    <div class="card"><div class="lbl">Dans le sac</div>${items.length ? items.join("") : `<p class="empty">Sac vide. Arrête-toi près d'une caisse pour la fouiller.</p>`}</div>
    <div class="card"><div class="lbl">Équipé</div>${p.wpn ? row(p.wpn, "") : ""}${row(p.mel, "")}${p.arm ? row(p.arm, "") : ""}
      <div class="item"><div class="nm"><b>${Math.ceil(p.hp)} / ${p.max} PV</b><small>${p.meds} trousse(s) et ${p.keys} clé(s) emportée(s)</small></div></div></div>
    <p class="note">Ce que tu jettes reste au sol et apparaît dans « Au sol » tant que tu es à côté.</p>
    <button class="go" data-a="back">Reprendre</button></div>`;
}

export function initBag() {
  $("bag").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || !R) return;
    const r = R, a = b.dataset.a, u = b.dataset.u;
    if (a === "back") {
      swapFor = null;
      return closeBag();
    }
    if (a === "cancel") swapFor = null;
    if (a === "pick") swapFor = swapFor === u ? null : u!;
    const bi = r.bag.findIndex((x) => x.u === u), gi = r.pick.findIndex((k) => k.it.u === u);
    const fromBag = () => r.bag.splice(bi, 1)[0], fromGround = () => r.pick.splice(gi, 1)[0].it;
    if (bi >= 0) {
      const it = r.bag[bi];
      if (a === "drop") drop(r, fromBag());
      if (a === "use") useItem(it);
      if (a === "eq") {
        const old = equip(r, fromBag());
        if (old) r.bag.push(old);
      }
      if (a === "swap" && swapFor) {
        const gj = r.pick.findIndex((k) => k.it.u === swapFor);
        if (gj >= 0) {
          drop(r, fromBag());
          r.bag.push(r.pick.splice(gj, 1)[0].it);
          swapFor = null;
        }
      }
    }
    if (gi >= 0) {
      if (a === "take" && bagUsed(r.bag) + def(r.pick[gi].it.k).s <= cap()) r.bag.push(fromGround());
      // equipping from the ground leaves the replaced piece on the ground
      if (a === "geq") {
        const old = equip(r, fromGround());
        if (old) drop(r, old);
      }
    }
    updHud(r);
    renderBag();
  });
}
