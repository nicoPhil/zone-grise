import { mk, valOf, type Item } from "../items";
import { qInfo } from "../progression";
import type { Quest } from "../state";
import { $ } from "../util";
import { pinned, row, valTag } from "./row";
import { pin, popup } from "./popup";
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

let last: { res: RaidResult; extra: Item[] } | null = null;
/** Item whose popup is open. */
let sel: string | null = null;

export function renderEnd(res: RaidResult) {
  // trousses and keys carried in are counts, not items: give them stable items so their popup can be found again
  last = { res, extra: [...(res.meds ? [mk("med")] : []), ...(res.keys ? [mk("vkey")] : [])] };
  sel = null;
  draw();
}

const line = (i: Item, btns: string, extra = "") => row(i, btns, extra, 1, pinned(i.u));

function draw() {
  if (!last) return;
  const { res, extra } = last;
  let html: string;
  const [p0, p1] = res.power;
  const pw = p0 === p1 ? "" : `<div class="lbl">Puissance ${p0} → <span style="color:var(--${p1 > p0 ? "ok" : "bad"})">${p1}</span></div>`;
  const opened = res.opened
    ? `<div class="card unlock"><div class="lbl">Nouvelle zone</div><b>${res.opened} débloquée</b><small class="note">Choisis-la dans l'onglet Raid : plus dangereuse, meilleur loot.</small></div>`
    : "";
  if (res.ok) {
    const quests = res.quests.length
      ? `<div class="card"><div class="lbl">Contrats remplis</div>${res.quests.map((q) => `<div class="item"><div class="nm"><b>${qInfo(q).txt}</b><small>${q.cr} cr à réclamer dans l'onglet Contrats</small></div></div>`).join("")}</div>`
      : "";
    html = `<div class="lbl">Extraction réussie</div><h1 style="color:var(--ok)">Sorti vivant</h1><div class="res">+ ${res.val} cr de butin</div>${pw}${opened}${quests}
      <div class="card">${res.items.length ? res.items.map((i) => line(i, valTag(valOf(i)))).join("") : `<p class="empty">Sac vide, mais ton équipement est sauf.</p>`}</div>`;
  } else {
    const lost =
      res.items.map((i) => line(i, valTag(valOf(i)))).join("") +
      extra.map((i) => line(i, "", i.k === "med" ? res.meds + " trousse(s)" : res.keys + " clé(s) emportée(s)")).join("");
    html = `<div class="lbl">Raid perdu</div><h1 style="color:var(--bad)">${res.why}</h1><div class="res">− ${res.val} cr perdus</div>${pw}
      <div class="card">${lost || `<p class="empty">Tu n'avais rien à perdre. Le kit gratuit t'attend.</p>`}</div>`;
  }
  const it = sel ? [...res.items, ...extra].find((i) => i.u === sel) : null;
  $("end").innerHTML =
    `<div class="wrap">${html}${it ? popup(it, [], []) : ""}<button class="go" data-a="home">Retour à la planque</button></div>`;
  $("end").hidden = false;
  pin($("end"));
}

export function initEnd() {
  $("end").addEventListener("scroll", () => pin($("end")), { passive: true });
  $("end").addEventListener("click", (e) => {
    const t = e.target as HTMLElement,
      a = t.closest<HTMLElement>("[data-a]")?.dataset.a,
      at = t.closest<HTMLElement>(".item[data-u]");
    if (a === "close" || (!a && at)) {
      sel = a ? null : at!.dataset.u!;
      return draw();
    }
    if (a !== "home") return;
    $("end").hidden = true;
    $("stash").hidden = false;
    renderStash();
    $("stash").scrollTop = 0;
  });
}
