import { FREE, ITEMS, SHOP, def, desc, mk, nameOf, price, valOf, wstat, type ItemKey } from "../items";
import { BENCH, KEY_MAX, MAX_LV, UP, canPay, cap, costParts, count, maxHp, medMax, norm, pay, qInfo, type Cost } from "../progression";
import { startRaid } from "../raid";
import { assetsReady } from "../render/assets";
import { KEY, S, save, setMode, type Upgrades } from "../state";
import { $, fmtRate } from "../util";
import { ZONES, UNLOCK_AFTER, power, unlocked } from "../zones";
import { toast } from "./hud";
import { row } from "./row";

type Tab = "raid" | "quest" | "shop" | "trade";
const TABS: Tab[] = ["raid", "quest", "shop", "trade"];
let tab: Tab = "raid";
try {
  const t = localStorage.getItem(KEY + "-tab");
  if (TABS.includes(t as Tab)) tab = t as Tab;
} catch {
  // storage blocked: start on the raid tab
}

const REROLL = 40;
const costTxt = (c: Cost) =>
  `${c.cr} cr` + costParts(c).map((p) => ` · ${p.n} × ${ITEMS[p.k].n} <span class="${p.have >= p.n ? "have" : "miss"}">(${p.have}/${p.n})</span>`).join("");

/** Items a contract or the next upgrade still asks for, so the player doesn't sell them by mistake. */
function needed() {
  const n = new Map<ItemKey, string>();
  const add = (c: Cost, why: string) => {
    for (const k of Object.keys(c.it) as ItemKey[]) if (!n.has(k)) n.set(k, why);
  };
  for (const q of S.q) if (q.t === "bring" && q.k) n.set(q.k, "contrat");
  for (const k of Object.keys(UP) as (keyof Upgrades)[]) if (S.up[k] < MAX_LV) add(UP[k].cost[S.up[k]], "atelier");
  if (S.lo.w && (S.lo.w.lv || 0) < MAX_LV) add(BENCH[S.lo.w.lv || 0], "atelier");
  return n;
}

function tabRaid() {
  const lo = S.lo, meds = count("med"), keys = count("vkey"), need = needed();
  const others = S.stash.filter((i) => i.k !== "med" && i.k !== "vkey").sort((a, b) => valOf(b) - valOf(a));
  const stashVal = S.stash.reduce((s, i) => s + valOf(i), 0);
  const list = others.map((i) => {
    const t = def(i.k).t;
    const btns = `<div class="btns">${t === "wpn" || t === "arm" ? `<button data-a="eq" data-u="${i.u}">Équiper</button>` : ""}<button data-a="sell" data-u="${i.u}">${valOf(i)} cr</button></div>`;
    return row(i, btns, need.has(i.k) ? `${desc(i)} · <span class="need">utile : ${need.get(i.k)}</span>` : "");
  });
  return `<div class="card"><div class="lbl">Ce que tu emportes</div>
      ${lo.w ? row(lo.w, `<div class="btns"><button data-a="unw">Retirer</button></div>`) : row(mk(FREE), "", "Kit gratuit, donné si tu n'as pas d'arme · corps à corps")}
      ${lo.a ? row(lo.a, `<div class="btns"><button data-a="una">Retirer</button></div>`) : `<div class="item"><div class="nm"><b>Pas de gilet</b><small>Dégâts subis normaux</small></div></div>`}
      <div class="item"><div class="nm"><b>Trousses de soin : ${lo.meds} / ${medMax()}</b><small>${meds} en planque · ${maxHp()} PV · sac de ${cap()} places</small></div>
        <div class="btns"><button data-a="medm" ${lo.meds ? "" : "disabled"} aria-label="Laisser une trousse">−</button><button data-a="medp" ${meds && lo.meds < medMax() ? "" : "disabled"} aria-label="Prendre une trousse">+</button></div></div>
      <div class="item"><div class="nm"><b>Clés de salle forte : ${lo.keys} / ${KEY_MAX}</b><small>${keys} en planque · ouvrent la salle forte gardée par la Brute</small></div>
        <div class="btns"><button data-a="keym" ${lo.keys ? "" : "disabled"} aria-label="Laisser une clé">−</button><button data-a="keyp" ${keys && lo.keys < KEY_MAX ? "" : "disabled"} aria-label="Prendre une clé">+</button></div></div>
      <p class="note">Si tu meurs, tu perds tout ce qui est ici et tout ce qu'il y a dans ton sac.</p>
    </div>
    ${zonePicker()}
    <button class="go" data-a="raid">Partir · ${ZONES[S.zone].name}</button>
    <div class="card"><div class="top"><div class="lbl">Planque · ${S.stash.length} objets</div><div class="val">${stashVal} cr</div></div>
      ${list.length ? list.join("") : `<p class="empty">Rien pour l'instant. Le loot ramené d'un raid arrive ici.</p>`}
      ${meds ? row(mk("med"), `<div class="btns"><button data-a="sellmed">${ITEMS.med.v} cr</button></div>`, `${meds} en stock · Rend 40 PV en 2 s`) : ""}
      ${keys ? row(mk("vkey"), `<div class="btns"><button data-a="sellkey">${ITEMS.vkey.v} cr</button></div>`, `${keys} en stock · Ouvre une salle forte`) : ""}
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

function tabShop() {
  const w = S.lo.w, lv = w ? w.lv || 0 : 0;
  let bench: string;
  if (!w) bench = `<p class="empty">Équipe une arme dans l'onglet Raid pour l'améliorer.</p>`;
  else if (lv >= MAX_LV) bench = row(w, `<span class="val">Max</span>`);
  else {
    const cur = wstat(w), nx = wstat({ ...w, lv: lv + 1 }), c = BENCH[lv];
    bench = `<div class="item"><div class="nm"><b style="color:var(--r${def(w.k).r})">${nameOf(w)} → +${lv + 1}</b>
      <small>Dégâts ${cur.dmg} → ${nx.dmg} · cadence ${fmtRate(cur.rate)} → ${fmtRate(nx.rate)}</small><small>${costTxt(c)}</small></div>
      <div class="btns"><button data-a="bench" ${canPay(c) ? "" : "disabled"}>Améliorer</button></div></div>`;
  }
  const ups = (Object.keys(UP) as (keyof Upgrades)[]).map((k) => {
    const u = UP[k], l = S.up[k], more = l < MAX_LV;
    return `<div class="item"><div class="nm"><b>${u.n} · ${u.lv[l]}</b><small>${more ? `Suivant : ${u.lv[l + 1]}` : "Niveau maximum"}</small>${more ? `<small>${costTxt(u.cost[l])}</small>` : ""}</div>
      <div class="btns">${more ? `<button data-a="up" data-k="${k}" ${canPay(u.cost[l]) ? "" : "disabled"}>Améliorer</button>` : `<span class="val">Max</span>`}</div></div>`;
  });
  return `<div class="card"><div class="lbl">Améliorations de la planque</div>${ups.join("")}</div>
    <div class="card"><div class="lbl">Établi · arme équipée</div>${bench}</div>`;
}

function tabTrade() {
  const rows = SHOP.map((k) => row(mk(k), `<div class="btns"><button data-a="buy" data-k="${k}" ${S.credits >= price(k) ? "" : "disabled"}>${price(k)} cr</button></div>`));
  return `<div class="card"><div class="lbl">Marchand</div>${rows.join("")}
    <p class="note">Les objets de valeur ne s'achètent pas : il faut les trouver en raid.</p></div>`;
}

export function renderStash() {
  setMode("stash");
  norm();
  const upReady =
    (Object.keys(UP) as (keyof Upgrades)[]).some((k) => S.up[k] < MAX_LV && canPay(UP[k].cost[S.up[k]])) ||
    (!!S.lo.w && (S.lo.w.lv || 0) < MAX_LV && canPay(BENCH[S.lo.w.lv || 0]));
  const tabs: [Tab, string, boolean][] = [
    ["raid", "Raid", false],
    ["quest", "Contrats", S.q.some((q) => qInfo(q).done)],
    ["shop", "Atelier", upReady],
    ["trade", "Marchand", false],
  ];
  const body = { raid: tabRaid, quest: tabQuest, shop: tabShop, trade: tabTrade }[tab];
  $("stash").innerHTML = `<div class="wrap">
    <div class="ver">version ${__BUILD__}</div>
    <div class="top"><div><div class="lbl">Planque</div><h1>Zone Grise</h1></div>
      <div style="text-align:right"><div class="lbl">Puissance · crédits</div><div class="cr"><span class="pw">${power()}</span> · ${S.credits} cr</div></div></div>
    <div class="tabs" role="tablist">${tabs.map(([id, n, dot]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}">${n}${dot ? ` <span class="dot" aria-label="action possible">●</span>` : ""}</button>`).join("")}</div>
    ${body()}
    <p class="note">${S.st.raids} raids · ${S.st.ext} extractions · ${S.st.dead} morts · meilleur butin ${S.st.best} cr · graphismes Kenney (CC0)</p>
  </div>`;
}

export function initStash() {
  $("stash").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.dataset.tab) {
      tab = b.dataset.tab as Tab;
      try {
        localStorage.setItem(KEY + "-tab", tab);
      } catch {
        // tab choice is a convenience only
      }
      return renderStash();
    }
    const a = b.dataset.a, lo = S.lo;
    const take = (u?: string) => {
      const i = S.stash.findIndex((x) => x.u === u);
      return i < 0 ? null : S.stash.splice(i, 1)[0];
    };
    if (a === "zone") {
      const z = Number(b.dataset.z);
      if (unlocked(S, z)) S.zone = z;
    }
    if (a === "raid") {
      assetsReady.then(startRaid);
      return;
    }
    if (a === "unw" && lo.w) {
      S.stash.push(lo.w);
      lo.w = null;
    }
    if (a === "una" && lo.a) {
      S.stash.push(lo.a);
      lo.a = null;
    }
    if (a === "medp" && lo.meds < medMax() && take(S.stash.find((i) => i.k === "med")?.u)) lo.meds++;
    if (a === "medm" && lo.meds) {
      lo.meds--;
      S.stash.push(mk("med"));
    }
    if (a === "eq") {
      const it = take(b.dataset.u);
      if (it) {
        const slot = def(it.k).t === "wpn" ? "w" : "a";
        const old = lo[slot];
        if (old) S.stash.push(old);
        lo[slot] = it;
      }
    }
    if (a === "sell") {
      const it = take(b.dataset.u);
      if (it) S.credits += valOf(it);
    }
    if (a === "sellmed" && take(S.stash.find((i) => i.k === "med")?.u)) S.credits += ITEMS.med.v;
    if (a === "sellkey" && take(S.stash.find((i) => i.k === "vkey")?.u)) S.credits += ITEMS.vkey.v;
    if (a === "keyp" && lo.keys < KEY_MAX && take(S.stash.find((i) => i.k === "vkey")?.u)) lo.keys++;
    if (a === "keym" && lo.keys) {
      lo.keys--;
      S.stash.push(mk("vkey"));
    }
    if (a === "buy") {
      const k = b.dataset.k as ItemKey;
      if (S.credits >= price(k)) {
        S.credits -= price(k);
        S.stash.push(mk(k));
      }
    }
    if (a === "up") {
      const k = b.dataset.k as keyof Upgrades, l = S.up[k];
      if (l < MAX_LV && canPay(UP[k].cost[l])) {
        pay(UP[k].cost[l]);
        S.up[k]++;
        toast(UP[k].n + " : " + UP[k].lv[S.up[k]]);
      }
    }
    if (a === "bench" && lo.w) {
      const l = lo.w.lv || 0;
      if (l < MAX_LV && canPay(BENCH[l])) {
        pay(BENCH[l]);
        lo.w.lv = l + 1;
        toast(nameOf(lo.w) + " prêt");
      }
    }
    if (a === "claim") {
      const i = S.q.findIndex((q) => q.u === b.dataset.q), q = S.q[i];
      if (q && qInfo(q).done) {
        if (q.t === "bring" && q.k) pay({ cr: 0, it: { [q.k]: q.n } });
        S.credits += q.cr;
        if (q.rew) S.stash.push(mk(q.rew));
        S.q.splice(i, 1);
        toast("Contrat payé : +" + q.cr + " cr" + (q.rew ? " + " + ITEMS[q.rew].n : ""));
      }
    }
    if (a === "reroll" && S.credits >= REROLL) {
      const i = S.q.findIndex((q) => q.u === b.dataset.q);
      if (i >= 0) {
        S.credits -= REROLL;
        S.q.splice(i, 1);
      }
    }
    save();
    renderStash();
  });
}
