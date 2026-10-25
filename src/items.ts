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
  | (Base & Mods & { t: "gear"; slot: WornSlot });

/** Bonuses a worn piece gives; fractions are percentages (0.1 = +10 %), cap is bag places, hp is max HP. */
export interface Mods {
  red?: number;
  hp?: number;
  spd?: number;
  cap?: number;
  mel?: number;
  fire?: number;
  vis?: number;
  quiet?: number;
}
export type WornSlot = "head" | "body" | "hands" | "feet" | "back" | "trinket";
export type Slot = WornSlot | "gun" | "blade";
export const SLOTS: Record<Slot, string> = {
  head: "Tête", trinket: "Accessoire", back: "Dos", gun: "Arme à feu", body: "Torse", blade: "Arme blanche", hands: "Mains", feet: "Pieds",
};
const gear = (n: string, slot: WornSlot, r: number, v: number, s: number, m: Mods) => ({ n, t: "gear", slot, r, v, s, ...m }) as const;

const melee = (n: string, r: number, v: number, dmg: number, rate: number, range: number, kb = 0) =>
  ({ n, t: "wpn", r, v, s: 2, dmg, rate, range, spr: 0, pel: 1, noise: 60, mel: true, kb }) as const;

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
  p9: { n: "Pistolet 9 mm", t: "wpn", r: 0, v: 120, s: 2, dmg: 14, rate: 2.8, range: 300, spr: 0.05, pel: 1, noise: 200 },
  revolver: { n: "Revolver", t: "wpn", r: 1, v: 300, s: 2, dmg: 34, rate: 1.4, range: 330, spr: 0.03, pel: 1, noise: 260 },
  smg: { n: "PM compact", t: "wpn", r: 1, v: 380, s: 2, dmg: 8, rate: 8, range: 250, spr: 0.13, pel: 1, noise: 240 },
  sg: { n: "Fusil à pompe", t: "wpn", r: 1, v: 450, s: 2, dmg: 9, rate: 1.1, range: 200, spr: 0.3, pel: 6, noise: 280 },
  carbine: { n: "Carabine", t: "wpn", r: 2, v: 800, s: 2, dmg: 26, rate: 3, range: 430, spr: 0.02, pel: 1, noise: 270 },
  ar: { n: "Fusil d'assaut", t: "wpn", r: 2, v: 900, s: 2, dmg: 17, rate: 5, range: 360, spr: 0.05, pel: 1, noise: 290 },
  dmr: { n: "Fusil de précision", t: "wpn", r: 3, v: 1400, s: 2, dmg: 60, rate: 1.2, range: 520, spr: 0.01, pel: 1, noise: 340 },
  lmg: { n: "Mitrailleuse légère", t: "wpn", r: 3, v: 1600, s: 3, dmg: 15, rate: 10, range: 340, spr: 0.1, pel: 1, noise: 340 },
  jacket: gear("Veste renforcée", "body", 0, 80, 2, { red: 0.1 }),
  vest1: gear("Gilet léger", "body", 1, 220, 2, { red: 0.2 }),
  vest2: gear("Gilet lourd", "body", 2, 700, 2, { red: 0.4 }),
  armor: gear("Armure de combat", "body", 3, 1500, 3, { red: 0.5 }),
  beanie: gear("Bonnet épais", "head", 0, 40, 1, { red: 0.03 }),
  hardhat: gear("Casque de chantier", "head", 1, 150, 2, { red: 0.06, hp: 10 }),
  helmet: gear("Casque balistique", "head", 2, 600, 2, { red: 0.12 }),
  visor: gear("Casque à visière", "head", 3, 1300, 2, { red: 0.15, vis: 0.15 }),
  workgloves: gear("Gants de travail", "hands", 0, 40, 1, { mel: 0.1 }),
  tacgloves: gear("Gants tactiques", "hands", 1, 180, 1, { fire: 0.1 }),
  knuckles: gear("Gants coqués", "hands", 2, 520, 1, { mel: 0.3 }),
  sniperglv: gear("Gants de tireur d'élite", "hands", 3, 1200, 1, { fire: 0.2, mel: 0.1 }),
  sneakers: gear("Baskets", "feet", 0, 50, 2, { spd: 0.05 }),
  boots: gear("Rangers", "feet", 1, 200, 2, { spd: 0.04, red: 0.04 }),
  trail: gear("Chaussures de trail", "feet", 2, 550, 2, { spd: 0.12 }),
  felt: gear("Bottes feutrées", "feet", 3, 1250, 2, { spd: 0.08, quiet: 0.3 }),
  satchel: gear("Musette", "back", 0, 60, 2, { cap: 2 }),
  daypack: gear("Sac de randonnée", "back", 1, 240, 2, { cap: 4 }),
  milpack: gear("Sac militaire", "back", 2, 650, 3, { cap: 6 }),
  exppack: gear("Sac d'expédition", "back", 3, 1400, 3, { cap: 9 }),
  headlamp: gear("Lampe frontale", "trinket", 1, 200, 1, { vis: 0.3 }),
  medal: gear("Médaille porte-bonheur", "trinket", 1, 220, 1, { hp: 15 }),
  jammer: gear("Brouilleur", "trinket", 2, 600, 1, { quiet: 0.25 }),
  vial: gear("Fiole de sérum", "trinket", 3, 1300, 1, { hp: 30, red: 0.05 }),
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
export const isBlade = (it: Item) => {
  const d = def(it.k);
  return d.t === "wpn" && !!d.mel;
};
/** The free knife stands in for an empty blade slot. */
export const KNIFE: Item = { k: FREE, u: "free-knife" };
export const slotOf = (it: Item): Slot | null => {
  const d = def(it.k);
  return d.t === "gear" ? d.slot : d.t === "wpn" ? (d.mel ? "blade" : "gun") : null;
};

export type Gear = Record<Slot, Item | null>;
export const emptyGear = (): Gear => ({ head: null, body: null, hands: null, feet: null, back: null, trinket: null, gun: null, blade: null });
export const RED_CAP = 0.7;
export function gearStats(g: Gear): Required<Mods> {
  const s: Required<Mods> = { red: 0, hp: 0, spd: 0, cap: 0, mel: 0, fire: 0, vis: 0, quiet: 0 };
  for (const it of Object.values(g)) {
    const d = it && def(it.k);
    if (d?.t !== "gear") continue;
    for (const k of Object.keys(s) as (keyof Mods)[]) s[k] += d[k] || 0;
  }
  s.red = Math.min(RED_CAP, +s.red.toFixed(2));
  return s;
}

export function wstat(it: Item): WeaponStats {
  const d = def(it.k);
  if (d.t !== "wpn") throw new Error(`${it.k} is not a weapon`);
  const lv = it.lv || 0;
  return { ...d, dmg: Math.round(d.dmg * (1 + 0.15 * lv)), rate: +(d.rate * (1 + 0.1 * lv)).toFixed(1) };
}

export const dps = (it: Item) => {
  const w = wstat(it);
  return w.dmg * w.pel * w.rate;
};

/** Would this piece beat what sits in the slot it would take? Weapons compare on damage, worn pieces on value. */
export function upgradeOver(it: Item, g: Gear): boolean {
  const slot = slotOf(it);
  if (!slot) return false;
  const cur = slot === "blade" ? g.blade || KNIFE : g[slot];
  if (!cur) return true;
  return def(it.k).t === "wpn" ? dps(it) > dps(cur) : valOf(it) > valOf(cur);
}

const pct = (x: number) => Math.round(x * 100) + " %";
/** One short line per bonus, for item details and the character sheet. */
export function modLines(m: Mods): string[] {
  const out: string[] = [];
  if (m.red) out.push(`−${pct(m.red)} de dégâts subis`);
  if (m.hp) out.push(`+${m.hp} PV max`);
  if (m.spd) out.push(`+${pct(m.spd)} de vitesse`);
  if (m.cap) out.push(`+${m.cap} places de sac`);
  if (m.mel) out.push(`+${pct(m.mel)} de dégâts à la lame`);
  if (m.fire) out.push(`+${pct(m.fire)} de cadence de tir`);
  if (m.vis) out.push(`+${pct(m.vis)} de vision`);
  if (m.quiet) out.push(`−${pct(m.quiet)} de distance de repérage`);
  return out;
}

export function desc(it: Item): string {
  const d = def(it.k);
  if (d.t === "wpn") {
    const w = wstat(it);
    if (w.mel) return `${w.dmg} dég · ${fmtRate(w.rate)} coups/s · corps à corps, silencieux`;
    return `${w.pel > 1 ? w.pel + "×" : ""}${w.dmg} dég · ${fmtRate(w.rate)} tirs/s · portée ${fmtM(w.range)}`;
  }
  if (d.t === "gear") return `${SLOTS[d.slot]} · ${modLines(d).join(" · ")}`;
  if (d.t === "med") return `Rend ${d.heal} PV en ${d.dur} s`;
  if (d.t === "stim") return `+35 % de vitesse pendant ${d.dur} s`;
  if (d.t === "key") return "Ouvre une salle forte";
  return RAR[d.r];
}
