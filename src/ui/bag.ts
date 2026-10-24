import { bagUsed, def, desc, valOf } from "../items";
import { cap } from "../progression";
import { R, clock, heal } from "../raid";
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

function renderBag() {
  if (!R) return;
  const p = R.p, val = R.bag.reduce((s, i) => s + valOf(i), 0);
  const items = R.bag.map((i) => {
    const d = def(i.k);
    const btns = `<div class="btns">${d.t === "wpn" || d.t === "arm" ? `<button data-a="eq" data-u="${i.u}">Équiper</button>` : ""}${d.t === "med" ? `<button data-a="use" data-u="${i.u}">Utiliser</button>` : ""}<button data-a="drop" data-u="${i.u}">Jeter</button></div>`;
    return row(i, btns, `${desc(i)} · ${d.s} place${d.s > 1 ? "s" : ""} · ${valOf(i)} cr`);
  });
  $("bag").innerHTML = `<div class="wrap">
    <div class="top"><h2>Sac ${bagUsed(R.bag)} / ${cap()}</h2><div class="val">${val} cr</div></div>
    <div class="card"><div class="lbl">Équipé</div>${row(p.wpn, "")}${p.arm ? row(p.arm, "") : ""}
      <div class="item"><div class="nm"><b>${Math.ceil(p.hp)} / ${p.max} PV</b><small>${p.meds} trousse(s) et ${p.keys} clé(s) emportée(s)</small></div></div></div>
    <div class="card">${items.length ? items.join("") : `<p class="empty">Sac vide. Arrête-toi près d'une caisse pour la fouiller.</p>`}</div>
    <p class="note">Les caisses violettes, au centre de la carte, contiennent le meilleur loot. Les tirs font du bruit et attirent les ennemis.</p>
    <button class="go" data-a="back">Reprendre</button></div>`;
}

export function initBag() {
  $("bag").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || !R) return;
    if (b.dataset.a === "back") return closeBag();
    const p = R.p, i = R.bag.findIndex((x) => x.u === b.dataset.u);
    if (i < 0) return;
    const it = R.bag[i], t = def(it.k).t;
    if (b.dataset.a === "drop") {
      R.bag.splice(i, 1);
      R.pick.push({ x: p.x, y: p.y, it, nop: true });
    }
    if (b.dataset.a === "use") {
      R.bag.splice(i, 1);
      p.meds++;
      heal();
    }
    if (b.dataset.a === "eq") {
      R.bag.splice(i, 1);
      if (t === "wpn") {
        R.bag.push(p.wpn);
        p.wpn = it;
      } else {
        if (p.arm) R.bag.push(p.arm);
        p.arm = it;
      }
    }
    updHud(R);
    renderBag();
  });
}
