import { mk, valOf, type Item } from "../items";
import { qInfo } from "../progression";
import type { Quest } from "../state";
import { $ } from "../util";
import { row, valTag } from "./row";
import { renderStash } from "./stash";

export interface RaidResult {
  ok: boolean;
  why: string;
  val: number;
  items: Item[];
  meds: number;
  keys: number;
  quests: Quest[];
  power: [number, number];
  /** name of the zone this extraction unlocked, if any */
  opened: string;
}

export function renderEnd(res: RaidResult) {
  let html: string;
  const [p0, p1] = res.power;
  const pw = p0 === p1 ? "" : `<div class="lbl">Puissance ${p0} → <span style="color:var(--${p1 > p0 ? "ok" : "bad"})">${p1}</span></div>`;
  const opened = res.opened ? `<div class="card unlock"><div class="lbl">Nouvelle zone</div><b>${res.opened} débloquée</b><small class="note">Choisis-la dans l'onglet Raid : plus dangereuse, meilleur loot.</small></div>` : "";
  if (res.ok) {
    const quests = res.quests.length
      ? `<div class="card"><div class="lbl">Contrats remplis</div>${res.quests.map((q) => `<div class="item"><div class="nm"><b>${qInfo(q).txt}</b><small>${q.cr} cr à réclamer dans l'onglet Contrats</small></div></div>`).join("")}</div>`
      : "";
    html = `<div class="lbl">Extraction réussie</div><h1 style="color:var(--ok)">Sorti vivant</h1><div class="res">+ ${res.val} cr de butin</div>${pw}${opened}${quests}
      <div class="card">${res.items.length ? res.items.map((i) => row(i, valTag(valOf(i)))).join("") : `<p class="empty">Sac vide, mais ton équipement est sauf.</p>`}</div>`;
  } else {
    const lost =
      res.items.map((i) => row(i, valTag(valOf(i)))).join("") +
      (res.meds ? row(mk("med"), "", res.meds + " trousse(s)") : "") +
      (res.keys ? row(mk("vkey"), "", res.keys + " clé(s) emportée(s)") : "");
    html = `<div class="lbl">Raid perdu</div><h1 style="color:var(--bad)">${res.why}</h1><div class="res">− ${res.val} cr perdus</div>${pw}
      <div class="card">${lost || `<p class="empty">Tu n'avais rien à perdre. Le kit gratuit t'attend.</p>`}</div>`;
  }
  $("end").innerHTML = `<div class="wrap">${html}<button class="go" data-a="home">Retour à la planque</button></div>`;
  $("end").hidden = false;
}

export function initEnd() {
  $("end").addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("button")) return;
    $("end").hidden = true;
    $("stash").hidden = false;
    renderStash();
    $("stash").scrollTop = 0;
  });
}
