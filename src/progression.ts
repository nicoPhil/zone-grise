import { ITEMS, KEYS, def, type ItemKey } from "./items";
import { S, type Quest, type Upgrades } from "./state";
import { pick, uid } from "./util";

export interface Cost {
  cr: number;
  it: Partial<Record<ItemKey, number>>;
}
interface Upgrade {
  n: string;
  lv: string[];
  cost: Cost[];
}

export const UP: Record<keyof Upgrades, Upgrade> = {
  bag: { n: "Sac à dos", lv: ["10 places", "14 places", "18 places"], cost: [{ cr: 600, it: { wires: 2 } }, { cr: 1800, it: { hdd: 2, gpu: 1 } }] },
  meds: { n: "Poche à trousses", lv: ["3 trousses", "4 trousses", "5 trousses"], cost: [{ cr: 300, it: { pills: 2 } }, { cr: 900, it: { pills: 3, watch: 1 } }] },
  hp: { n: "Entraînement", lv: ["100 PV", "125 PV", "150 PV"], cost: [{ cr: 500, it: { batt: 3 } }, { cr: 1500, it: { gold: 1, pills: 2 } }] },
};
export const BENCH: Cost[] = [{ cr: 250, it: { scrap: 3 } }, { cr: 700, it: { wires: 2, hdd: 1 } }];
export const MAX_LV = 2;

export const cap = () => [10, 14, 18][S.up.bag];
export const medMax = () => 3 + S.up.meds;
export const maxHp = () => [100, 125, 150][S.up.hp];

export const count = (k: ItemKey) => S.stash.filter((i) => i.k === k).length;
const costItems = (c: Cost) => Object.entries(c.it) as [ItemKey, number][];
export const canPay = (c: Cost) => S.credits >= c.cr && costItems(c).every(([k, n]) => count(k) >= n);
export function pay(c: Cost) {
  S.credits -= c.cr;
  for (const [k, n] of costItems(c))
    for (let j = 0; j < n; j++) S.stash.splice(S.stash.findIndex((i) => i.k === k), 1);
}
export const costParts = (c: Cost) => costItems(c).map(([k, n]) => ({ k, n, have: Math.min(count(k), n) }));

const BRING: ItemKey[] = ["wires", "batt", "pills", "watch", "hdd", "gpu", "gold"];

export function newQuest(): Quest {
  const lvl = Math.min(3, Math.floor(S.st.ext / 3));
  const taken = new Set(S.q.map((q) => q.t + (q.k || "")));
  for (let t = 0; t < 40; t++) {
    const ty = pick(["bring", "bring", "kills", "violet", "haul"] as const);
    let q: Omit<Quest, "u" | "have">;
    if (ty === "bring") {
      const k = pick(BRING.filter((k) => def(k).r <= Math.min(2, lvl + 1)));
      const n = def(k).r >= 2 ? 1 : 2 + Math.floor(Math.random() * 2);
      q = { t: ty, k, n, cr: Math.round((def(k).v * n * 1.7) / 10) * 10 };
    } else if (ty === "kills") {
      const n = [4, 6, 8, 10][lvl];
      q = { t: ty, n, cr: n * 45 };
    } else if (ty === "violet") {
      const n = [1, 2, 2, 3][lvl];
      q = { t: ty, n, cr: n * 260 };
    } else {
      const n = [300, 600, 1000, 1600][lvl];
      q = { t: ty, n, cr: Math.round(n * 0.5) };
    }
    if (taken.has(q.t + (q.k || ""))) continue;
    if (Math.random() < 0.25)
      q.rew = pick(KEYS.filter((k) => (def(k).t === "wpn" || def(k).t === "arm") && def(k).r >= 1 && def(k).r <= lvl + 1));
    return { u: uid(), have: 0, ...q };
  }
  return { u: uid(), have: 0, t: "kills", n: 5, cr: 225 };
}

export function qInfo(q: Quest) {
  if (q.t === "bring" && q.k) {
    const h = count(q.k);
    return { txt: `Livrer ${q.n} × ${ITEMS[q.k].n}`, h: Math.min(h, q.n), n: q.n, done: h >= q.n, act: "Livrer" };
  }
  if (q.t === "kills")
    return { txt: `Éliminer ${q.n} ennemis et s'extraire`, h: Math.min(q.have, q.n), n: q.n, done: q.have >= q.n, act: "Réclamer" };
  if (q.t === "violet") {
    const pl = q.n > 1 ? "s" : "";
    return { txt: `Fouiller ${q.n} caisse${pl} violette${pl} et s'extraire`, h: Math.min(q.have, q.n), n: q.n, done: q.have >= q.n, act: "Réclamer" };
  }
  return { txt: `S'extraire avec au moins ${q.n} cr de butin en un seul raid`, h: q.have ? 1 : 0, n: 1, done: !!q.have, act: "Réclamer" };
}

/** Raid tallies only count once the player is out alive; returns the contracts this raid completed. */
export function applyRaid(kills: number, violet: number, haul: number): Quest[] {
  const before = new Set(S.q.filter((q) => qInfo(q).done).map((q) => q.u));
  for (const q of S.q) {
    if (q.t === "kills") q.have += kills;
    if (q.t === "violet") q.have += violet;
    if (q.t === "haul" && haul >= q.n) q.have = 1;
  }
  return S.q.filter((q) => qInfo(q).done && !before.has(q.u));
}

export function norm() {
  while (S.q.length < 3) S.q.push(newQuest());
  S.lo.meds = Math.min(S.lo.meds, medMax());
}
