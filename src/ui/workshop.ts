import { ITEMS, def, mk, nameOf, shieldOf, upgradeOver, wstat, type Item } from "../items";
import { RECIPES, STATIONS, benchBlock, benchCost, build, craft, improve, type Recipe } from "../economy";
import { MAX_LV, UP, canPay, costParts, pay, type Cost } from "../progression";
import { S, type Stations, type Upgrades } from "../state";
import { fmtRate } from "../util";
import { toast } from "./hud";
import { pinned, row } from "./row";

export const costTxt = (c: Cost) =>
  `${c.cr} cr` +
  costParts(c)
    .map((p) => ` · ${p.n} × ${ITEMS[p.k].n} <span class="${p.have >= p.n ? "have" : "miss"}">(${p.have}/${p.n})</span>`)
    .join("");

type Benched = "gun" | "blade" | "shield";
const BENCHED: Benched[] = ["gun", "blade", "shield"];
const STA = Object.keys(STATIONS) as (keyof Stations)[];
const UPS = () => Object.keys(UP) as (keyof Upgrades)[];

/** What the next bench level changes on this piece. */
function gain(w: Item, nx: Item) {
  const a = shieldOf(w),
    b = shieldOf(nx);
  if (a && b) return `Réserve ${a.pts} → ${b.pts} pts`;
  const cur = wstat(w),
    up = wstat(nx);
  return `Dégâts ${cur.dmg} → ${up.dmg} · cadence ${fmtRate(cur.rate)} → ${fmtRate(up.rate)}`;
}

function benchRow(w: Item, slot: Benched) {
  const lv = w.lv || 0,
    block = benchBlock(w);
  if (lv >= MAX_LV) return row(w, `<span class="val">Max</span>`);
  const c = benchCost(w);
  const btn = block
    ? `<span class="val">${block}</span>`
    : `<button data-a="bench" data-s="${slot}" ${canPay(c) ? "" : "disabled"}>Améliorer</button>`;
  return `<div class="item" ${pinned(w.u)}><div class="nm"><b style="color:var(--r${def(w.k).r})">${nameOf(w)} → +${lv + 1}</b>
      <small>${gain(w, { ...w, lv: lv + 1 })}</small><small>${costTxt(c)}</small></div>
      <div class="btns">${btn}</div></div>`;
}

function stationRow(k: keyof Stations) {
  const st = STATIONS[k],
    l = S.sta[k],
    c = st.cost[l];
  const next = c ? `<small>Niveau ${l + 1} : ${st.lv[l + 1]}</small><small>${costTxt(c)}</small>` : "<small>Niveau maximum</small>";
  const btn = c
    ? `<button data-a="station" data-k="${k}" ${canPay(c) ? "" : "disabled"}>Construire</button>`
    : `<span class="val">Max</span>`;
  return `<div class="item"><div class="nm"><b>${st.n} · niv. ${l}</b><small>${st.lv[l]}</small>${next}</div><div class="btns">${btn}</div></div>`;
}

function upRow(k: keyof Upgrades) {
  const u = UP[k],
    l = S.up[k],
    more = l < MAX_LV;
  return `<div class="item"><div class="nm"><b>${u.n} · ${u.lv[l]}</b><small>${more ? `Suivant : ${u.lv[l + 1]}` : "Niveau maximum"}</small>${more ? `<small>${costTxt(u.cost[l])}</small>` : ""}</div>
      <div class="btns">${more ? `<button data-a="up" data-k="${k}" ${canPay(u.cost[l]) ? "" : "disabled"}>Améliorer</button>` : `<span class="val">Max</span>`}</div></div>`;
}

const RECIPE_PIN = "recipe:";

function recipeRow(rc: Recipe, i: number) {
  const it = { k: rc.out, u: RECIPE_PIN + i },
    open = rc.bench <= S.sta.bench;
  const btn = open
    ? `<button data-a="craft" data-i="${i}" ${canPay(rc.cost) ? "" : "disabled"}>Fabriquer</button>`
    : `<span class="val">Établi niv. ${rc.bench}</span>`;
  const better = upgradeOver(mk(rc.out), S.lo.eq) ? ` · <span class="better">↑ mieux que l'équipé</span>` : "";
  return row(it, `<div class="btns">${btn}</div>`, costTxt(rc.cost) + better);
}

export function tabWorkshop() {
  const rows = BENCHED.flatMap((s) => {
    const it = S.lo.eq[s];
    return it ? [benchRow(it, s)] : [];
  });
  const bench = rows.length ? rows.join("") : `<p class="empty">Équipe une arme ou un bouclier dans l'onglet Raid pour l'améliorer.</p>`;
  return `<div class="card"><div class="lbl">Stations</div>${STA.map(stationRow).join("")}</div>
    <div class="card"><div class="lbl">Améliorations de la planque</div>${UPS().map(upRow).join("")}</div>
    <div class="card"><div class="lbl">Établi · armes équipées</div>${bench}</div>
    <div class="card"><div class="lbl">Établi · fabrication</div>${RECIPES.map(recipeRow).join("")}
      <p class="note">Les composants viennent des ennemis : chaque zone en apporte de nouveaux.</p></div>`;
}

/** The recipe whose card is open, for the stash popup. */
export const recipeOf = (pin: string) => (pin.startsWith(RECIPE_PIN) ? RECIPES[Number(pin.slice(RECIPE_PIN.length))] : undefined);

/** Something in the workshop can be bought right now: the tab gets a dot. */
export function workshopReady(): boolean {
  const benchable = BENCHED.map((s) => S.lo.eq[s]).filter((w): w is Item => !!w && !benchBlock(w));
  return (
    UPS().some((k) => S.up[k] < MAX_LV && canPay(UP[k].cost[S.up[k]])) ||
    STA.some((k) => STATIONS[k].cost[S.sta[k]] && canPay(STATIONS[k].cost[S.sta[k]])) ||
    benchable.some((w) => canPay(benchCost(w))) ||
    RECIPES.some((rc) => rc.bench <= S.sta.bench && upgradeOver(mk(rc.out), S.lo.eq) && canPay(rc.cost))
  );
}

function upgrade(b: HTMLElement) {
  const k = b.dataset.k as keyof Upgrades,
    l = S.up[k];
  if (l >= MAX_LV || !canPay(UP[k].cost[l])) return;
  pay(UP[k].cost[l]);
  S.up[k]++;
  toast(UP[k].n + " : " + UP[k].lv[S.up[k]]);
}

function bench(b: HTMLElement) {
  const bw = S.lo.eq[BENCHED.find((s) => s === b.dataset.s) ?? "gun"];
  if (bw && improve(bw)) toast(nameOf(bw) + " prêt");
}

function station(b: HTMLElement) {
  const k = STA.find((s) => s === b.dataset.k);
  if (k && build(k)) toast(`${STATIONS[k].n} : ${STATIONS[k].lv[S.sta[k]]}`);
}

function craftOne(b: HTMLElement) {
  const rc = RECIPES[Number(b.dataset.i)];
  if (rc && craft(rc)) toast(ITEMS[rc.out].n + " fabriqué : il est au coffre");
}

export const WORKSHOP_ACTIONS = { up: upgrade, bench, station, craft: craftOne };
