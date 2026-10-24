import { fmtM, fmtRate, uid } from "./util";

export interface WeaponStats {
  dmg: number;
  rate: number;
  /** reach for melee weapons */
  range: number;
  spr: number;
  pel: number;
  noise: number;
  mel?: boolean;
  /** melee knockback, px */
  kb?: number;
}
interface Base {
  n: string;
  r: number;
  v: number;
  s: number;
}
export type ItemDef =
  | (Base & { t: "val" | "key" })
  | (Base & { t: "med"; heal: number; dur: number })
  | (Base & { t: "stim"; dur: number })
  | (Base & WeaponStats & { t: "wpn" })
  | (Base & { t: "arm"; red: number });

const melee = (n: string, r: number, v: number, dmg: number, rate: number, range: number, kb = 0) =>
  ({ n, t: "wpn", r, v, s: 2, dmg, rate, range, spr: 0, pel: 1, noise: 80, mel: true, kb }) as const;

export const ITEMS = {
  cans: { n: "Boîte de conserve", t: "val", r: 0, v: 12, s: 1 },
  water: { n: "Bouteille d'eau", t: "val", r: 0, v: 10, s: 1 },
  bolts: { n: "Vis et boulons", t: "val", r: 0, v: 14, s: 1 },
  scrap: { n: "Ferraille", t: "val", r: 0, v: 15, s: 1 },
  tape: { n: "Ruban adhésif", t: "val", r: 0, v: 18, s: 1 },
  wires: { n: "Câbles en cuivre", t: "val", r: 0, v: 25, s: 1 },
  batt: { n: "Piles", t: "val", r: 0, v: 30, s: 1 },
  cigs: { n: "Cartouche de cigarettes", t: "val", r: 1, v: 60, s: 1 },
  torch: { n: "Lampe torche", t: "val", r: 1, v: 70, s: 1 },
  pills: { n: "Antibiotiques", t: "val", r: 1, v: 80, s: 1 },
  watch: { n: "Montre", t: "val", r: 1, v: 95, s: 1 },
  radio: { n: "Radio portable", t: "val", r: 1, v: 110, s: 1 },
  hdd: { n: "Disque dur", t: "val", r: 1, v: 120, s: 1 },
  binoc: { n: "Jumelles", t: "val", r: 1, v: 130, s: 1 },
  gpu: { n: "Carte graphique", t: "val", r: 2, v: 360, s: 2 },
  milbat: { n: "Batterie militaire", t: "val", r: 2, v: 380, s: 2 },
  gold: { n: "Lingot d'or", t: "val", r: 2, v: 420, s: 1 },
  laptop: { n: "Ordinateur portable", t: "val", r: 2, v: 450, s: 2 },
  jewels: { n: "Bijoux", t: "val", r: 2, v: 500, s: 1 },
  key: { n: "Clé chiffrée", t: "val", r: 3, v: 900, s: 1 },
  goldwatch: { n: "Montre en or", t: "val", r: 3, v: 1000, s: 1 },
  dossier: { n: "Dossier secret", t: "val", r: 3, v: 1100, s: 1 },
  proto: { n: "Prototype", t: "val", r: 3, v: 1300, s: 2 },
  virus: { n: "Échantillon viral", t: "val", r: 3, v: 1500, s: 1 },
  bandage: { n: "Bandage", t: "med", r: 0, v: 20, s: 1, heal: 15, dur: 1 },
  med: { n: "Trousse de soin", t: "med", r: 1, v: 60, s: 1, heal: 40, dur: 2 },
  stim: { n: "Stimulant", t: "stim", r: 1, v: 90, s: 1, dur: 8 },
  vkey: { n: "Clé de salle forte", t: "key", r: 2, v: 150, s: 1 },
  knife: melee("Couteau", 0, 0, 18, 2.5, 38, 6),
  pipe: melee("Tuyau de plomb", 0, 40, 20, 1.6, 38, 10),
  bat: melee("Batte cloutée", 1, 140, 22, 1.7, 44, 22),
  machete: melee("Machette", 1, 160, 26, 1.8, 40),
  axe: melee("Hache d'incendie", 2, 420, 48, 1.1, 44, 26),
  katana: melee("Katana", 3, 1100, 40, 2.6, 48),
  p9: { n: "Pistolet 9 mm", t: "wpn", r: 0, v: 120, s: 2, dmg: 14, rate: 2.8, range: 300, spr: 0.05, pel: 1, noise: 320 },
  revolver: { n: "Revolver", t: "wpn", r: 1, v: 300, s: 2, dmg: 34, rate: 1.4, range: 330, spr: 0.03, pel: 1, noise: 420 },
  smg: { n: "PM compact", t: "wpn", r: 1, v: 380, s: 2, dmg: 8, rate: 8, range: 250, spr: 0.13, pel: 1, noise: 380 },
  sg: { n: "Fusil à pompe", t: "wpn", r: 1, v: 450, s: 2, dmg: 9, rate: 1.1, range: 200, spr: 0.3, pel: 6, noise: 460 },
  carbine: { n: "Carabine", t: "wpn", r: 2, v: 800, s: 2, dmg: 26, rate: 3, range: 430, spr: 0.02, pel: 1, noise: 450 },
  ar: { n: "Fusil d'assaut", t: "wpn", r: 2, v: 900, s: 2, dmg: 17, rate: 5, range: 360, spr: 0.05, pel: 1, noise: 480 },
  dmr: { n: "Fusil de précision", t: "wpn", r: 3, v: 1400, s: 2, dmg: 60, rate: 1.2, range: 520, spr: 0.01, pel: 1, noise: 560 },
  lmg: { n: "Mitrailleuse légère", t: "wpn", r: 3, v: 1600, s: 3, dmg: 15, rate: 10, range: 340, spr: 0.1, pel: 1, noise: 560 },
  jacket: { n: "Veste renforcée", t: "arm", r: 0, v: 80, s: 2, red: 0.1 },
  vest1: { n: "Gilet léger", t: "arm", r: 1, v: 220, s: 2, red: 0.2 },
  vest2: { n: "Gilet lourd", t: "arm", r: 2, v: 700, s: 2, red: 0.4 },
  armor: { n: "Armure de combat", t: "arm", r: 3, v: 1500, s: 3, red: 0.5 },
} satisfies Record<string, ItemDef>;

export type ItemKey = keyof typeof ITEMS;
export interface Item {
  k: ItemKey;
  u: string;
  lv?: number;
}

export const KEYS = Object.keys(ITEMS) as ItemKey[];
/** handed out when the player has no weapon; never dropped, never kept */
export const FREE: ItemKey = "knife";
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
    if (w.mel) return `${w.dmg} dég · ${fmtRate(w.rate)} coups/s · corps à corps, silencieux`;
    return `${w.pel > 1 ? w.pel + "×" : ""}${w.dmg} dég · ${fmtRate(w.rate)} tirs/s · portée ${fmtM(w.range)}`;
  }
  if (d.t === "arm") return `−${d.red * 100} % de dégâts subis`;
  if (d.t === "med") return `Rend ${d.heal} PV en ${d.dur} s`;
  if (d.t === "stim") return `+35 % de vitesse pendant ${d.dur} s`;
  if (d.t === "key") return "Ouvre une salle forte";
  return RAR[d.r];
}
