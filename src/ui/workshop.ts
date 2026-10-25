import { ITEMS, def, desc, mk, nameOf, shieldOf, upgradeOver, wstat, type Item } from "../items";
import { RECIPES, STATIONS, benchBlock, benchCost, build, craft, improve, type Recipe } from "../economy";
import { MAX_LV, UP, canPay, costParts, pay, type Cost } from "../progression";
import { S, type Stations, type Upgrades } from "../state";
import { fmtRate } from "../util";
import { toast } from "./hud";
import { icon, type Icon } from "./icons";
import { pinned, row, starTag } from "./row";

/** A cost as chips, one per credit sum or item, green when the stash covers it. */
export const chips = (c: Cost) =>
  `<span class="chips"><span class="chip ${S.credits >= c.cr ? "ok" : "ko"}">${c.cr} cr</span>${costParts(c)
    .map((p) => `<span class="chip ${p.have >= p.n ? "ok" : "ko"}">${ITEMS[p.k].n} ${p.have}/${p.n}</span>`)
    .join("")}</span>`;

const pips = (l: number, max: number) =>
  `<span class="pips" aria-label="niveau ${l} sur ${max}">${"●".repeat(l)}${"○".repeat(max - l)}</span>`;

const btn = (label: string, data: string, c: Cost) => `<button ${data} ${canPay(c) ? "" : "disabled"}>${label}</button>`;
const MAX = `<span class="val">Max</span>`;

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
  const lv = w.lv || 0;
  if (lv >= MAX_LV) return row(w, MAX);
  const c = benchCost(w),
    block = benchBlock(w);
  const act = block ? `<span class="val">${block}</span>` : btn("Améliorer", `data-a="bench" data-s="${slot}"`, c);
  return `<div class="item" ${pinned(w.u)}><div class="nm"><b style="color:var(--r${def(w.k).r})">${nameOf(w)}${starTag(w)} ${pips(lv, MAX_LV)}</b>
      <small class="next">→ +${lv + 1} : ${gain(w, { ...w, lv: lv + 1 })}</small>${chips(c)}</div>
      <div class="btns">${act}</div></div>`;
}

function stationRow(k: keyof Stations) {
  const st = STATIONS[k],
    l = S.sta[k],
    c = st.cost[l];
  const next = c ? `<small class="next">→ ${st.lv[l + 1]}</small>${chips(c)}` : "";
  return `<div class="item"><div class="nm"><b>${st.n} ${pips(l, st.cost.length)}</b><small>${st.lv[l]}</small>${next}</div>
    <div class="btns">${c ? btn("Construire", `data-a="station" data-k="${k}"`, c) : MAX}</div></div>`;
}

function upRow(k: keyof Upgrades) {
  const u = UP[k],
    l = S.up[k],
    c = l < MAX_LV ? u.cost[l] : null;
  const next = c ? `<small class="next">→ ${u.lv[l + 1]}</small>${chips(c)}` : "";
  return `<div class="item"><div class="nm"><b>${u.n} ${pips(l, MAX_LV)}</b><small>${u.lv[l]}</small>${next}</div>
    <div class="btns">${c ? btn("Améliorer", `data-a="up" data-k="${k}"`, c) : MAX}</div></div>`;
}

const RECIPE_PIN = "recipe:";

function recipeRow(rc: Recipe) {
  const i = RECIPES.indexOf(rc),
    out = mk(rc.out);
  const better = upgradeOver(out, S.lo.eq) ? ` · <span class="better">↑ mieux que l'équipé</span>` : "";
  const act = rc.bench <= S.sta.bench ? btn("Fabriquer", `data-a="craft" data-i="${i}"`, rc.cost) : "";
  return `<div class="item" ${pinned(RECIPE_PIN + i)}><div class="nm"><b style="color:var(--r${def(rc.out).r})">${ITEMS[rc.out].n}</b>
      <small>${desc(out)}${better}</small>${chips(rc.cost)}</div><div class="btns">${act}</div></div>`;
}

const benchable = () => BENCHED.map((s) => S.lo.eq[s]).filter((w): w is Item => !!w && !benchBlock(w));
const affordable = (c: Cost | undefined) => !!c && canPay(c);

type Sub = "base" | "bench" | "craft";
const SUBS: { id: Sub; n: string; ic: Icon; ready: () => boolean; body: () => string }[] = [
  {
    id: "base",
    n: "Planque",
    ic: "home",
    ready: () =>
      UPS().some((k) => S.up[k] < MAX_LV && canPay(UP[k].cost[S.up[k]])) || STA.some((k) => affordable(STATIONS[k].cost[S.sta[k]])),
    body: () => `<div class="card"><div class="lbl">Stations</div>${STA.map(stationRow).join("")}</div>
      <div class="card"><div class="lbl">Améliorations</div>${UPS().map(upRow).join("")}</div>`,
  },
  {
    id: "bench",
    n: "Établi",
    ic: "hammer",
    ready: () => benchable().some((w) => canPay(benchCost(w))),
    body: () => {
      const rows = BENCHED.flatMap((s) => (S.lo.eq[s] ? [benchRow(S.lo.eq[s] as Item, s)] : []));
      return `<div class="card"><div class="lbl">Équipement porté</div>${rows.join("") || `<p class="empty">Équipe une arme ou un bouclier dans l'onglet Raid pour l'améliorer.</p>`}
        <p class="note">Le niveau de l'Établi (onglet Planque) plafonne les améliorations : niv. ${S.sta.bench}.</p></div>`;
    },
  },
  {
    id: "craft",
    n: "Fabrication",
    ic: "craft",
    ready: () => RECIPES.some((rc) => rc.bench <= S.sta.bench && upgradeOver(mk(rc.out), S.lo.eq) && canPay(rc.cost)),
    body: () =>
      [1, 2, 3]
        .map((lv) => {
          const lock = lv > S.sta.bench ? " · à construire" : "";
          return `<div class="card${lock ? " locked" : ""}"><div class="lbl">Établi niv. ${lv}${lock}</div>${RECIPES.filter(
            (rc) => rc.bench === lv,
          )
            .map(recipeRow)
            .join("")}</div>`;
        })
        .join("") + `<p class="note">Les composants viennent des ennemis : chaque zone en apporte de nouveaux.</p>`,
  },
];

let sub: Sub = "base";
try {
  const t = localStorage.getItem("zone-grise-workshop");
  if (SUBS.some((x) => x.id === t)) sub = t as Sub;
} catch {
  // storage blocked: open on the hideout
}

export function tabWorkshop() {
  const nav = SUBS.map(
    (x) =>
      `<button role="tab" data-a="wsub" data-sub="${x.id}" aria-selected="${sub === x.id}">${icon(x.ic)}${x.n}${x.ready() ? ` <span class="dot" aria-label="action possible">●</span>` : ""}</button>`,
  );
  return `<div class="subtabs" role="tablist">${nav.join("")}</div>${(SUBS.find((x) => x.id === sub) ?? SUBS[0]).body()}`;
}

/** The recipe whose card is open, for the stash popup. */
export const recipeOf = (pin: string) => (pin.startsWith(RECIPE_PIN) ? RECIPES[Number(pin.slice(RECIPE_PIN.length))] : undefined);

/** Something in the workshop can be bought right now: the tab gets a dot. */
export const workshopReady = () => SUBS.some((x) => x.ready());

function pickSub(b: HTMLElement) {
  const t = SUBS.find((x) => x.id === b.dataset.sub);
  if (!t) return;
  sub = t.id;
  try {
    localStorage.setItem("zone-grise-workshop", sub);
  } catch {
    // the open sub-tab is a convenience only
  }
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

export const WORKSHOP_ACTIONS = { up: upgrade, bench, station, craft: craftOne, wsub: pickSub };
