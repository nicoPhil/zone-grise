import {
  ITEMS,
  SHOP,
  def,
  desc,
  gearStats,
  mk,
  nameOf,
  price,
  slotOf,
  upgradeOver,
  valOf,
  shieldOf,
  wstat,
  type Item,
  type ItemKey,
  type Slot,
} from "../items";
import { BENCH, KEY_MAX, MAX_LV, UP, canPay, cap, costParts, count, maxHp, medMax, norm, pay, qInfo, type Cost } from "../progression";
import { startRaid } from "../raid";
import { assetsReady } from "../render/assets";
import { KEY, S, save, setMode, type Upgrades } from "../state";
import { $, fmtRate } from "../util";
import { ZONES, UNLOCK_AFTER, power, unlocked } from "../zones";
import { toast } from "./hud";
import { icon, type Icon } from "./icons";
import { pin, popup } from "./popup";
import { pinned, row, stackKey, stacks } from "./row";
import { sheet } from "./sheet";

type Tab = "raid" | "stash" | "quest" | "shop" | "trade";
const TAB_IC: Record<Tab, Icon> = { raid: "fire", stash: "stash", quest: "quest", shop: "shop", trade: "trade" };
const TABS: Tab[] = ["raid", "stash", "quest", "shop", "trade"];
let tab: Tab = "raid";
/** Item whose detail popup is open, in the stash or worn. */
let sel: string | null = null;
try {
  const t = localStorage.getItem(KEY + "-tab");
  if (TABS.includes(t as Tab)) tab = t as Tab;
} catch {
  // storage blocked: start on the raid tab
}

const REROLL = 40;
const costTxt = (c: Cost) =>
  `${c.cr} cr` +
  costParts(c)
    .map((p) => ` · ${p.n} × ${ITEMS[p.k].n} <span class="${p.have >= p.n ? "have" : "miss"}">(${p.have}/${p.n})</span>`)
    .join("");

type Benched = "gun" | "blade" | "shield";
const BENCHED: Benched[] = ["gun", "blade", "shield"];
/** Worn pieces the bench can improve: weapons and the shield. */
const benchable = () => BENCHED.map((s) => S.lo.eq[s]).filter((w): w is Item => !!w);

/** Items a contract or the next upgrade still asks for, so the player doesn't sell them by mistake. */
function needed() {
  const n = new Map<ItemKey, string>();
  const add = (c: Cost, why: string) => {
    for (const k of Object.keys(c.it) as ItemKey[]) if (!n.has(k)) n.set(k, why);
  };
  for (const q of S.q) if (q.t === "bring" && q.k) n.set(q.k, "contrat");
  for (const k of Object.keys(UP) as (keyof Upgrades)[]) if (S.up[k] < MAX_LV) add(UP[k].cost[S.up[k]], "atelier");
  for (const w of benchable()) if ((w.lv || 0) < MAX_LV) add(BENCH[w.lv || 0], "atelier");
  return n;
}

function tabRaid() {
  const lo = S.lo,
    meds = count("med"),
    keys = count("vkey"),
    st = gearStats(lo.eq);
  return `<div class="card"><div class="lbl">Personnage · touche un emplacement pour ses détails</div>
      ${sheet(lo.eq, { st, hp: maxHp() + st.hp, cap: cap() + st.cap, sel })}
    </div>
    <div class="card"><div class="lbl">Ce que tu emportes</div>
      <div class="item"><div class="nm"><b>Trousses de soin : ${lo.meds} / ${medMax()}</b><small>${meds} en planque</small></div>
        <div class="btns"><button data-a="medm" ${lo.meds ? "" : "disabled"} aria-label="Laisser une trousse">−</button><button data-a="medp" ${meds && lo.meds < medMax() ? "" : "disabled"} aria-label="Prendre une trousse">+</button></div></div>
      <div class="item"><div class="nm"><b>Clés de salle forte : ${lo.keys} / ${KEY_MAX}</b><small>${keys} en planque · ouvrent la salle forte gardée par la Brute</small></div>
        <div class="btns"><button data-a="keym" ${lo.keys ? "" : "disabled"} aria-label="Laisser une clé">−</button><button data-a="keyp" ${keys && lo.keys < KEY_MAX ? "" : "disabled"} aria-label="Prendre une clé">+</button></div></div>
      <p class="note">Si tu meurs, tu perds tout ton équipement, ce qui est ici et tout ce qu'il y a dans ton sac.</p>
    </div>
    ${zonePicker()}
    <button class="go" data-a="raid">Partir · ${ZONES[S.zone].name}</button>`;
}

function tabStash() {
  const lo = S.lo,
    need = needed(),
    stashVal = S.stash.reduce((s, i) => s + valOf(i), 0);
  const up = (i: Item) => (upgradeOver(i, lo.eq) ? 1 : 0);
  // upgrades over what is worn come first, then by value
  const list = stacks([...S.stash].sort((a, b) => up(b) - up(a) || valOf(b) - valOf(a))).map((g) => {
    const i = g[0],
      t = def(i.k).t;
    const eq = t === "wpn" || t === "gear" ? `<button data-a="eq" data-u="${i.u}" aria-label="Équiper">${icon("equip")}</button>` : "";
    const all =
      g.length > 1
        ? `<button data-a="sellall" data-g="${stackKey(i)}" aria-label="Tout vendre">${icon("sellAll")}${valOf(i) * g.length}</button>`
        : "";
    const btns = `<div class="btns">${eq}<button data-a="sell" data-u="${i.u}" aria-label="Vendre">${icon("sell")}${valOf(i)}</button>${all}</div>`;
    const tags = [
      upgradeOver(i, lo.eq) ? `<span class="better">↑ mieux que l'équipé</span>` : "",
      need.has(i.k) ? `<span class="need">utile : ${need.get(i.k)}</span>` : "",
    ].filter(Boolean);
    return row(i, btns, [desc(i), ...tags].join(" · "), g.length);
  });
  return `<div class="card"><div class="top"><div class="lbl">Planque · ${S.stash.length} objets</div><div class="val">${stashVal} cr</div></div>
      ${list.length ? list.join("") : `<p class="empty">Rien pour l'instant. Le loot ramené d'un raid arrive ici.</p>`}
      <p class="note">${icon("equip")} équiper · ${icon("sell")} vendre un · ${icon("sellAll")} tout vendre (prix en cr)</p>
    </div>`;
}

function zonePicker() {
  const pw = power();
  const cards = ZONES.map((z, i) => {
    if (!unlocked(S, i))
      return `<button class="zone" disabled><span class="zt"><b>${z.name}</b><span class="pw-low">verrouillée</span></span><small>${S.zx[i - 1]}/${UNLOCK_AFTER} extractions en ${ZONES[i - 1].name} pour débloquer</small></button>`;
    return `<button class="zone" data-a="zone" data-z="${i}" aria-pressed="${S.zone === i}"><span class="zt"><b>${z.name}</b>
      <span class="pw ${pw >= z.power ? "pw-ok" : "pw-low"}">conseillé ${z.power}</span></span><small>${z.blurb} · ${S.zx[i]} extraction${S.zx[i] > 1 ? "s" : ""}</small></button>`;
  });
  return `<div class="card"><div class="lbl">Zone</div><div class="zones">${cards.join("")}</div></div>`;
}

function tabQuest() {
  const qs = S.q.map((q) => {
    const f = qInfo(q);
    const btn = f.done
      ? `<button class="claim" data-a="claim" data-q="${q.u}">${f.act}</button>`
      : `<button data-a="reroll" data-q="${q.u}" ${S.credits >= REROLL ? "" : "disabled"}>Changer · ${REROLL} cr</button>`;
    return `<div class="item"><div class="nm"><b>${f.txt}</b><small>Récompense : ${q.cr} cr${q.rew ? " + " + ITEMS[q.rew].n : ""}</small>
      <div class="prog" aria-label="${f.h} sur ${f.n}"><i style="width:${(f.h / f.n) * 100}%"></i></div></div>
      <div class="btns">${btn}</div></div>`;
  });
  return `<div class="card"><div class="lbl">Contrats du marchand</div>${qs.join("")}
    <p class="note">Les ennemis éliminés et les caisses fouillées ne comptent que si tu t'extrais vivant.</p></div>`;
}

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
  if (lv >= MAX_LV) return row(w, `<span class="val">Max</span>`);
  const c = BENCH[lv];
  return `<div class="item" ${pinned(w.u)}><div class="nm"><b style="color:var(--r${def(w.k).r})">${nameOf(w)} → +${lv + 1}</b>
      <small>${gain(w, { ...w, lv: lv + 1 })}</small><small>${costTxt(c)}</small></div>
      <div class="btns"><button data-a="bench" data-s="${slot}" ${canPay(c) ? "" : "disabled"}>Améliorer</button></div></div>`;
}

function tabShop() {
  const rows = BENCHED.flatMap((s) => {
    const it = S.lo.eq[s];
    return it ? [benchRow(it, s)] : [];
  });
  const bench = rows.length ? rows.join("") : `<p class="empty">Équipe une arme ou un bouclier dans l'onglet Raid pour l'améliorer.</p>`;
  const ups = (Object.keys(UP) as (keyof Upgrades)[]).map((k) => {
    const u = UP[k],
      l = S.up[k],
      more = l < MAX_LV;
    return `<div class="item"><div class="nm"><b>${u.n} · ${u.lv[l]}</b><small>${more ? `Suivant : ${u.lv[l + 1]}` : "Niveau maximum"}</small>${more ? `<small>${costTxt(u.cost[l])}</small>` : ""}</div>
      <div class="btns">${more ? `<button data-a="up" data-k="${k}" ${canPay(u.cost[l]) ? "" : "disabled"}>Améliorer</button>` : `<span class="val">Max</span>`}</div></div>`;
  });
  return `<div class="card"><div class="lbl">Améliorations de la planque</div>${ups.join("")}</div>
    <div class="card"><div class="lbl">Établi · armes équipées</div>${bench}</div>`;
}

const SHOP_PIN = "shop:";
const buyBtn = (k: ItemKey) =>
  `<button data-a="buy" data-k="${k}" ${S.credits >= price(k) ? "" : "disabled"} aria-label="Acheter">${icon("buy")}${price(k)}</button>`;

function tabTrade() {
  const rows = SHOP.map((k) => row({ k, u: SHOP_PIN + k }, `<div class="btns">${buyBtn(k)}</div>`));
  return `<div class="card"><div class="lbl">Marchand</div>${rows.join("")}
    <p class="note">Les objets de valeur ne s'achètent pas : il faut les trouver en raid.</p></div>`;
}

function stashPopup() {
  if (sel?.startsWith(SHOP_PIN)) {
    const k = sel.slice(SHOP_PIN.length) as ItemKey;
    return popup({ k, u: sel }, [`${count(k)} au coffre`], [buyBtn(k)]);
  }
  const lo = S.lo,
    it = sel && S.stash.find((i) => i.u === sel);
  if (it) {
    const t = def(it.k).t,
      n = S.stash.filter((i) => stackKey(i) === stackKey(it)).length;
    return popup(
      it,
      [n > 1 ? `×${n} au coffre` : "", upgradeOver(it, lo.eq) ? `<span class="better">↑ mieux que l'équipé</span>` : ""].filter(Boolean),
      [
        t === "wpn" || t === "gear" ? `<button data-a="eq" data-u="${it.u}">${icon("equip")}Équiper</button>` : "",
        `<button data-a="sell" data-u="${it.u}" aria-label="Vendre">${icon("sell")}${valOf(it)}</button>`,
        n > 1
          ? `<button data-a="sellall" data-g="${stackKey(it)}" aria-label="Tout vendre">${icon("sellAll")}${valOf(it) * n}</button>`
          : "",
      ],
    );
  }
  const slot = sel ? (Object.keys(lo.eq) as Slot[]).find((k) => lo.eq[k]?.u === sel) : undefined,
    worn = slot && lo.eq[slot];
  if (!worn) return "";
  return popup(worn, ["équipé"], [`<button data-a="unequip" data-slot="${slot}">${icon("unequip")}Retirer</button>`]);
}

export function renderStash() {
  setMode("stash");
  norm();
  const upReady =
    (Object.keys(UP) as (keyof Upgrades)[]).some((k) => S.up[k] < MAX_LV && canPay(UP[k].cost[S.up[k]])) ||
    benchable().some((w) => (w.lv || 0) < MAX_LV && canPay(BENCH[w.lv || 0]));
  const tabs: [Tab, string, boolean][] = [
    ["raid", "Raid", false],
    ["stash", "Coffre", S.stash.some((i) => upgradeOver(i, S.lo.eq))],
    ["quest", "Contrats", S.q.some((q) => qInfo(q).done)],
    ["shop", "Atelier", upReady],
    ["trade", "Marchand", false],
  ];
  const body = { raid: tabRaid, stash: tabStash, quest: tabQuest, shop: tabShop, trade: tabTrade }[tab];
  $("stash").innerHTML = `<div class="wrap">
    <div class="ver">version ${__BUILD__}</div>
    <div class="top"><div><div class="lbl">Planque</div><h1>Zone Grise</h1></div>
      <div style="text-align:right"><div class="lbl">Puissance · crédits</div><div class="cr"><span class="pw">${power()}</span> · ${S.credits} cr</div></div></div>
    <div class="tabs" role="tablist">${tabs.map(([id, n, dot]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}">${icon(TAB_IC[id])}${n}${dot ? ` <span class="dot" aria-label="action possible">●</span>` : ""}</button>`).join("")}</div>
    ${body()}
    ${stashPopup()}
    <p class="note">${S.st.raids} raids · ${S.st.ext} extractions · ${S.st.dead} morts · meilleur butin ${S.st.best} cr · graphismes Kenney (CC0)</p>
  </div>`;
  pin($("stash"));
}

const take = (u?: string) => {
  const i = S.stash.findIndex((x) => x.u === u);
  return i < 0 ? null : S.stash.splice(i, 1)[0];
};

function unequip(b: HTMLElement) {
  const lo = S.lo,
    slot = b.dataset.slot as Slot | undefined,
    worn = slot && lo.eq[slot];
  if (!worn) return;
  S.stash.push(worn);
  lo.eq[slot] = null;
}

function equipFromStash(b: HTMLElement) {
  const it = S.stash.find((x) => x.u === b.dataset.u),
    s = it && slotOf(it);
  if (!it || !s) return;
  take(it.u);
  const old = S.lo.eq[s];
  if (old) S.stash.push(old);
  S.lo.eq[s] = it;
}

function sellAll(b: HTMLElement) {
  for (const it of S.stash.filter((i) => stackKey(i) === b.dataset.g)) {
    take(it.u);
    S.credits += valOf(it);
  }
}

function buy(b: HTMLElement) {
  const k = b.dataset.k as ItemKey;
  if (S.credits < price(k)) return;
  S.credits -= price(k);
  S.stash.push(mk(k));
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
  const bw = S.lo.eq[BENCHED.find((s) => s === b.dataset.s) ?? "gun"],
    l = bw?.lv || 0;
  if (!bw || l >= MAX_LV || !canPay(BENCH[l])) return;
  pay(BENCH[l]);
  bw.lv = l + 1;
  toast(nameOf(bw) + " prêt");
}

function claim(b: HTMLElement) {
  const i = S.q.findIndex((q) => q.u === b.dataset.q),
    q = S.q[i];
  if (!q || !qInfo(q).done) return;
  if (q.t === "bring" && q.k) pay({ cr: 0, it: { [q.k]: q.n } });
  S.credits += q.cr;
  if (q.rew) S.stash.push(mk(q.rew));
  S.q.splice(i, 1);
  toast("Contrat payé : +" + q.cr + " cr" + (q.rew ? " + " + ITEMS[q.rew].n : ""));
}

function reroll(b: HTMLElement) {
  const i = S.q.findIndex((q) => q.u === b.dataset.q);
  if (S.credits < REROLL || i < 0) return;
  S.credits -= REROLL;
  S.q.splice(i, 1);
}

function zone(b: HTMLElement) {
  const z = Number(b.dataset.z);
  if (unlocked(S, z)) S.zone = z;
}

function sell(b: HTMLElement) {
  const it = take(b.dataset.u);
  if (it) S.credits += valOf(it);
}

/** Moves one trousse or key between the stash and what the player carries in. */
function carry(k: "med" | "vkey", d: 1 | -1) {
  const lo = S.lo,
    f = k === "med" ? "meds" : "keys",
    max = k === "med" ? medMax() : KEY_MAX;
  if (d > 0 && lo[f] < max && take(S.stash.find((i) => i.k === k)?.u)) lo[f]++;
  if (d < 0 && lo[f]) {
    lo[f]--;
    S.stash.push(mk(k));
  }
}

const ACTIONS: Record<string, ((b: HTMLElement) => void) | undefined> = {
  zone,
  unequip,
  medp: () => carry("med", 1),
  medm: () => carry("med", -1),
  keyp: () => carry("vkey", 1),
  keym: () => carry("vkey", -1),
  eq: equipFromStash,
  sell,
  sellall: sellAll,
  buy,
  up: upgrade,
  bench,
  claim,
  reroll,
};

function pickTab(t: Tab) {
  tab = t;
  try {
    localStorage.setItem(KEY + "-tab", tab);
  } catch {
    // tab choice is a convenience only
  }
  renderStash();
}

function tapSlot(b: HTMLElement, was: string | null) {
  const slot = b.dataset.slot as Slot | undefined,
    worn = slot && S.lo.eq[slot];
  if (worn) sel = was === worn.u ? null : worn.u;
}

function onStashClick(t: HTMLElement) {
  const b = t.closest<HTMLElement>("button, .scrim");
  if (!b) {
    const u = t.closest<HTMLElement>(".item[data-u]")?.dataset.u;
    if (u) {
      sel = u;
      renderStash();
    }
    return;
  }
  const was = sel;
  sel = null;
  if (b.dataset.tab) return pickTab(b.dataset.tab as Tab);
  const a = b.dataset.a;
  if (a === "raid") {
    assetsReady.then(startRaid);
    return;
  }
  if (a) ACTIONS[a]?.(b);
  else tapSlot(b, was);
  save();
  renderStash();
}

export function initStash() {
  $("stash").addEventListener("scroll", () => pin($("stash")), { passive: true });
  $("stash").addEventListener("click", (e) => onStashClick(e.target as HTMLElement));
}
