import { ITEMS, KEYS, def, type ItemKey } from "./items";
import type { Kind } from "./raid";
import { S, type Quest, type Upgrades } from "./state";
import { pick, uid } from "./util";
import { ZONES, unlocked } from "./zones";

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
  bag: {
    n: "Sac à dos",
    lv: ["10 places", "14 places", "18 places", "22 places"],
    cost: [
      { cr: 600, it: { wires: 2, tape: 2 } },
      { cr: 1800, it: { hdd: 2, gpu: 1 } },
      { cr: 4000, it: { laptop: 1, milbat: 2 } },
    ],
  },
  meds: {
    n: "Poche à trousses",
    lv: ["3 trousses", "4 trousses", "5 trousses", "6 trousses"],
    cost: [
      { cr: 300, it: { pills: 2 } },
      { cr: 900, it: { pills: 3, radio: 1 } },
      { cr: 2500, it: { jewels: 1, binoc: 2 } },
    ],
  },
  hp: {
    n: "Entraînement",
    lv: ["100 PV", "125 PV", "150 PV", "175 PV"],
    cost: [
      { cr: 500, it: { batt: 3, cans: 2 } },
      { cr: 1500, it: { gold: 1, pills: 2 } },
      { cr: 4500, it: { virus: 1, goldwatch: 1 } },
    ],
  },
};
export const BENCH: Cost[] = [
  { cr: 250, it: { scrap: 3, bolts: 2 } },
  { cr: 700, it: { wires: 2, hdd: 1 } },
  { cr: 2000, it: { milbat: 1, dossier: 1 } },
];
export const MAX_LV = 3;

export const cap = () => [10, 14, 18, 22][S.up.bag];
export const medMax = () => 3 + S.up.meds;
export const maxHp = () => [100, 125, 150, 175][S.up.hp];

export const count = (k: ItemKey) => S.stash.filter((i) => i.k === k).length;
const costItems = (c: Cost) => Object.entries(c.it) as [ItemKey, number][];
export const canPay = (c: Cost) => S.credits >= c.cr && costItems(c).every(([k, n]) => count(k) >= n);
export function pay(c: Cost) {
  S.credits -= c.cr;
  for (const [k, n] of costItems(c))
    for (let j = 0; j < n; j++)
      S.stash.splice(
        S.stash.findIndex((i) => i.k === k),
        1,
      );
}
export const costParts = (c: Cost) => costItems(c).map(([k, n]) => ({ k, n, have: Math.min(count(k), n) }));

const BRING: ItemKey[] = [
  "tape",
  "wires",
  "batt",
  "cigs",
  "torch",
  "pills",
  "watch",
  "radio",
  "hdd",
  "binoc",
  "gpu",
  "milbat",
  "gold",
  "laptop",
  "jewels",
];

/** Components of the enemies the player can meet in the zones open to them. */
export function huntable(): ItemKey[] {
  const kinds = new Set<Kind>();
  ZONES.forEach((z, i) => {
    if (!unlocked(S, i)) return;
    for (const k of ["walker", "runner", "gunner", ...z.adds, ...(z.boss ? ["boss"] : [])] as Kind[]) kinds.add(k);
  });
  return KEYS.filter((k) => {
    const d = def(k);
    return d.t === "part" && kinds.has(d.src);
  });
}

export interface RaidTally {
  kills: number;
  violet: number;
  vaults: number;
  boss: number;
  haul: number;
}

export function newQuest(): Quest {
  const lvl = Math.min(3, Math.floor(S.st.ext / 3));
  const taken = new Set(S.q.map((q) => q.t + (q.k || "")));
  const types = ["bring", "hunt", "hunt", "kills", "violet", "haul", "vault", ...(lvl >= 1 ? (["boss"] as const) : [])] as const;
  for (let t = 0; t < 40; t++) {
    const ty = pick(types);
    let q: Omit<Quest, "u" | "have">;
    if (ty === "bring") {
      const k = pick(BRING.filter((k) => def(k).r <= Math.min(2, lvl + 1)));
      const n = def(k).r >= 2 ? 1 : 2 + Math.floor(Math.random() * 2);
      q = { t: ty, k, n, cr: Math.round((def(k).v * n * 1.7) / 10) * 10 };
    } else if (ty === "hunt") {
      // a hunt pays well over the component's resale, to make it worth picking that fight
      const k = pick(huntable()),
        n = [3, 2, 1, 1][def(k).r];
      q = { t: "bring", k, n, cr: Math.round((def(k).v * n * 3) / 10) * 10 };
    } else if (ty === "kills") {
      const n = [4, 6, 8, 10][lvl];
      q = { t: ty, n, cr: n * 45 };
    } else if (ty === "violet") {
      const n = [1, 2, 2, 3][lvl];
      q = { t: ty, n, cr: n * 260 };
    } else if (ty === "vault") q = { t: ty, n: 1, cr: 450 };
    else if (ty === "boss") q = { t: ty, n: 1, cr: 800 };
    else {
      const n = [300, 600, 1000, 1600][lvl];
      q = { t: ty, n, cr: Math.round(n * 0.5) };
    }
    if (taken.has(q.t + (q.k || ""))) continue;
    const roll = Math.random();
    if (roll < 0.2) q.rew = "vkey";
    else if (roll < 0.4)
      q.rew = pick(KEYS.filter((k) => (def(k).t === "wpn" || def(k).t === "gear") && def(k).r >= 1 && def(k).r <= lvl + 1));
    return { u: uid(), have: 0, ...q };
  }
  return { u: uid(), have: 0, t: "kills", n: 5, cr: 225 };
}

const TALLY: Partial<Record<Quest["t"], [keyof RaidTally, (n: number) => string]>> = {
  kills: ["kills", (n) => `Éliminer ${n} ennemis et s'extraire`],
  violet: ["violet", (n) => `Fouiller ${n} caisse${n > 1 ? "s" : ""} militaire${n > 1 ? "s" : ""} et s'extraire`],
  vault: ["vaults", () => "Ouvrir une salle forte et s'extraire"],
  boss: ["boss", () => "Abattre la Brute et s'extraire"],
};

export function qInfo(q: Quest) {
  if (q.t === "bring" && q.k) {
    const h = count(q.k);
    return { txt: `Livrer ${q.n} × ${ITEMS[q.k].n}`, h: Math.min(h, q.n), n: q.n, done: h >= q.n, act: "Livrer" };
  }
  const t = TALLY[q.t];
  if (t) return { txt: t[1](q.n), h: Math.min(q.have, q.n), n: q.n, done: q.have >= q.n, act: "Réclamer" };
  return { txt: `S'extraire avec au moins ${q.n} cr de butin en un seul raid`, h: q.have ? 1 : 0, n: 1, done: !!q.have, act: "Réclamer" };
}

/** Raid tallies only count once the player is out alive; returns the contracts this raid completed. */
export function applyRaid(tally: RaidTally): Quest[] {
  const before = new Set(S.q.filter((q) => qInfo(q).done).map((q) => q.u));
  for (const q of S.q) {
    const t = TALLY[q.t];
    if (t) q.have += tally[t[0]];
    if (q.t === "haul" && tally.haul >= q.n) q.have = 1;
  }
  return S.q.filter((q) => qInfo(q).done && !before.has(q.u));
}

export const KEY_MAX = 2;

export function norm() {
  while (S.q.length < 3) S.q.push(newQuest());
  S.lo.meds = Math.min(S.lo.meds, medMax());
  S.lo.keys = Math.min(S.lo.keys, KEY_MAX);
}
