import { fmtM, fmtRate, uid } from "./util";

export interface WeaponStats {
  dmg: number;
  rate: number;
  range: number;
  spr: number;
  pel: number;
  noise: number;
}
interface Base {
  n: string;
  r: number;
  v: number;
  s: number;
}
export type ItemDef =
  | (Base & { t: "val" | "med" | "key" })
  | (Base & WeaponStats & { t: "wpn" })
  | (Base & { t: "arm"; red: number });

export const ITEMS = {
  scrap: { n: "Ferraille", t: "val", r: 0, v: 15, s: 1 },
  wires: { n: "Câbles en cuivre", t: "val", r: 0, v: 25, s: 1 },
  batt: { n: "Piles", t: "val", r: 0, v: 30, s: 1 },
  pills: { n: "Antibiotiques", t: "val", r: 1, v: 80, s: 1 },
  watch: { n: "Montre", t: "val", r: 1, v: 95, s: 1 },
  hdd: { n: "Disque dur", t: "val", r: 1, v: 120, s: 1 },
  gpu: { n: "Carte graphique", t: "val", r: 2, v: 360, s: 2 },
  gold: { n: "Lingot d'or", t: "val", r: 2, v: 420, s: 1 },
  key: { n: "Clé chiffrée", t: "val", r: 3, v: 900, s: 1 },
  proto: { n: "Prototype", t: "val", r: 3, v: 1300, s: 2 },
  med: { n: "Trousse de soin", t: "med", r: 1, v: 60, s: 1 },
  vkey: { n: "Clé de salle forte", t: "key", r: 2, v: 150, s: 1 },
  rusty: { n: "Pistolet rouillé", t: "wpn", r: 0, v: 0, s: 2, dmg: 10, rate: 2, range: 260, spr: 0.07, pel: 1, noise: 300 },
  p9: { n: "Pistolet 9 mm", t: "wpn", r: 0, v: 120, s: 2, dmg: 14, rate: 2.8, range: 300, spr: 0.05, pel: 1, noise: 320 },
  smg: { n: "PM compact", t: "wpn", r: 1, v: 380, s: 2, dmg: 8, rate: 8, range: 250, spr: 0.13, pel: 1, noise: 380 },
  sg: { n: "Fusil à pompe", t: "wpn", r: 1, v: 450, s: 2, dmg: 9, rate: 1.1, range: 200, spr: 0.3, pel: 6, noise: 460 },
  ar: { n: "Fusil d'assaut", t: "wpn", r: 2, v: 900, s: 2, dmg: 17, rate: 5, range: 360, spr: 0.05, pel: 1, noise: 480 },
  dmr: { n: "Fusil de précision", t: "wpn", r: 3, v: 1400, s: 2, dmg: 60, rate: 1.2, range: 520, spr: 0.01, pel: 1, noise: 560 },
  vest1: { n: "Gilet léger", t: "arm", r: 1, v: 220, s: 2, red: 0.2 },
  vest2: { n: "Gilet lourd", t: "arm", r: 2, v: 700, s: 2, red: 0.4 },
} satisfies Record<string, ItemDef>;

export type ItemKey = keyof typeof ITEMS;
export interface Item {
  k: ItemKey;
  u: string;
  lv?: number;
}

export const KEYS = Object.keys(ITEMS) as ItemKey[];
export const SHOP: ItemKey[] = ["p9", "vest1", "med"];
export const RAR = ["Commun", "Peu commun", "Rare", "Épique"];

export const def = (k: ItemKey): ItemDef => ITEMS[k];
export const isItemKey = (k: unknown): k is ItemKey => typeof k === "string" && k in ITEMS;
export const mk = (k: ItemKey): Item => ({ k, u: uid() });
export const price = (k: ItemKey) => Math.round(def(k).v * 1.6);
export const bagUsed = (b: Item[]) => b.reduce((s, i) => s + def(i.k).s, 0);
export const valOf = (it: Item) => Math.round(def(it.k).v * (1 + 0.3 * (it.lv || 0)));
export const nameOf = (it: Item) => def(it.k).n + (it.lv ? " +" + it.lv : "");
export const armorRed = (it: Item | null) => {
  const d = it && def(it.k);
  return d && d.t === "arm" ? d.red : 0;
};

export function wstat(it: Item): WeaponStats {
  const d = def(it.k);
  if (d.t !== "wpn") throw new Error(`${it.k} is not a weapon`);
  const lv = it.lv || 0;
  return { ...d, dmg: Math.round(d.dmg * (1 + 0.15 * lv)), rate: +(d.rate * (1 + 0.1 * lv)).toFixed(1) };
}

export function desc(it: Item): string {
  const d = def(it.k);
  if (d.t === "wpn") {
    const w = wstat(it);
    return `${w.pel > 1 ? w.pel + "×" : ""}${w.dmg} dég · ${fmtRate(w.rate)} tirs/s · portée ${fmtM(w.range)}`;
  }
  if (d.t === "arm") return `−${d.red * 100} % de dégâts subis`;
  if (d.t === "med") return "Rend 40 PV en 2 s";
  if (d.t === "key") return "Ouvre une salle forte";
  return RAR[d.r];
}
