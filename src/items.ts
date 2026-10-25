import type { Kind } from "./raid";
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
  | (Base & { t: "part"; src: Kind })
  | (Base & { t: "med"; heal: number; dur: number })
  | (Base & { t: "stim"; dur: number })
  | (Base & WeaponStats & { t: "wpn" })
  | (Base & Mods & { t: "gear"; slot: WornSlot })
  | (Base & ShieldStats & { t: "shield" });

/** A shield generator: a reserve of points taken before HP, refilling at `rate` per second once `delay` seconds pass unhit. */
export interface ShieldStats {
  pts: number;
  delay: number;
  rate: number;
}

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
export type Slot = WornSlot | "gun" | "blade" | "shield";
export const SLOTS: Record<Slot, string> = {
  head: "Tête",
  trinket: "Accessoire",
  back: "Dos",
  gun: "Arme à feu",
  body: "Torse",
  blade: "Arme blanche",
  hands: "Mains",
  feet: "Pieds",
  shield: "Bouclier",
};
const gear = (n: string, slot: WornSlot, base: { r: number; v: number; s: number }, m: Mods) =>
  ({ n, t: "gear", slot, ...base, ...m }) as const;

const shield = (n: string, base: { r: number; v: number; s: number }, [pts, delay, rate]: [number, number, number]) =>
  ({ n, t: "shield", ...base, pts, delay, rate }) as const;

const melee = (
  n: string,
  { r, v }: { r: number; v: number },
  { dmg, rate, range, kb = 0 }: { dmg: number; rate: number; range: number; kb?: number },
) => ({ n, t: "wpn", r, v, s: 2, dmg, rate, range, spr: 0, pel: 1, noise: 60, mel: true, kb }) as const;

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
  flesh: { n: "Échantillon de chair", t: "part", src: "walker", r: 0, v: 15, s: 1 },
  gland: { n: "Glande d'adrénaline", t: "part", src: "runner", r: 0, v: 20, s: 1 },
  gunparts: { n: "Pièces d'arme", t: "part", src: "gunner", r: 0, v: 25, s: 1 },
  gas: { n: "Poche de gaz", t: "part", src: "bloat", r: 1, v: 45, s: 1 },
  bolt: { n: "Mécanisme de culasse", t: "part", src: "smg", r: 1, v: 55, s: 1 },
  plate: { n: "Plaque blindée", t: "part", src: "shield", r: 1, v: 60, s: 1 },
  fang: { n: "Croc d'alpha", t: "part", src: "alpha", r: 2, v: 120, s: 1 },
  skin: { n: "Peau caméléon", t: "part", src: "stalker", r: 2, v: 140, s: 1 },
  scope: { n: "Optique", t: "part", src: "sniper", r: 2, v: 150, s: 1 },
  heart: { n: "Cœur de Brute", t: "part", src: "boss", r: 3, v: 400, s: 1 },
  knife: melee("Couteau", { r: 0, v: 0 }, { dmg: 18, rate: 2.5, range: 38, kb: 6 }),
  pipe: melee("Tuyau de plomb", { r: 0, v: 40 }, { dmg: 20, rate: 1.6, range: 38, kb: 10 }),
  bat: melee("Batte cloutée", { r: 1, v: 140 }, { dmg: 22, rate: 1.7, range: 44, kb: 22 }),
  machete: melee("Machette", { r: 1, v: 160 }, { dmg: 26, rate: 1.8, range: 40 }),
  axe: melee("Hache d'incendie", { r: 2, v: 420 }, { dmg: 48, rate: 1.1, range: 44, kb: 26 }),
  katana: melee("Katana", { r: 3, v: 1100 }, { dmg: 40, rate: 2.6, range: 48 }),
  p9: { n: "Pistolet 9 mm", t: "wpn", r: 0, v: 120, s: 2, dmg: 14, rate: 2.8, range: 300, spr: 0.05, pel: 1, noise: 200 },
  revolver: { n: "Revolver", t: "wpn", r: 1, v: 300, s: 2, dmg: 34, rate: 1.4, range: 330, spr: 0.03, pel: 1, noise: 260 },
  smg: { n: "PM compact", t: "wpn", r: 1, v: 380, s: 2, dmg: 8, rate: 8, range: 250, spr: 0.13, pel: 1, noise: 240 },
  sg: { n: "Fusil à pompe", t: "wpn", r: 1, v: 450, s: 2, dmg: 9, rate: 1.1, range: 200, spr: 0.3, pel: 6, noise: 280 },
  carbine: { n: "Carabine", t: "wpn", r: 2, v: 800, s: 2, dmg: 26, rate: 3, range: 430, spr: 0.02, pel: 1, noise: 270 },
  ar: { n: "Fusil d'assaut", t: "wpn", r: 2, v: 900, s: 2, dmg: 17, rate: 5, range: 360, spr: 0.05, pel: 1, noise: 290 },
  dmr: { n: "Fusil de précision", t: "wpn", r: 3, v: 1400, s: 2, dmg: 60, rate: 1.2, range: 520, spr: 0.01, pel: 1, noise: 340 },
  lmg: { n: "Mitrailleuse légère", t: "wpn", r: 3, v: 1600, s: 3, dmg: 15, rate: 10, range: 340, spr: 0.1, pel: 1, noise: 340 },
  jacket: gear("Veste renforcée", "body", { r: 0, v: 80, s: 2 }, { red: 0.1 }),
  vest1: gear("Gilet léger", "body", { r: 1, v: 220, s: 2 }, { red: 0.2 }),
  vest2: gear("Gilet lourd", "body", { r: 2, v: 700, s: 2 }, { red: 0.4 }),
  armor: gear("Armure de combat", "body", { r: 3, v: 1500, s: 3 }, { red: 0.5 }),
  beanie: gear("Bonnet épais", "head", { r: 0, v: 40, s: 1 }, { red: 0.03 }),
  hardhat: gear("Casque de chantier", "head", { r: 1, v: 150, s: 2 }, { red: 0.06, hp: 10 }),
  helmet: gear("Casque balistique", "head", { r: 2, v: 600, s: 2 }, { red: 0.12 }),
  visor: gear("Casque à visière", "head", { r: 3, v: 1300, s: 2 }, { red: 0.15, vis: 0.15 }),
  workgloves: gear("Gants de travail", "hands", { r: 0, v: 40, s: 1 }, { mel: 0.1 }),
  tacgloves: gear("Gants tactiques", "hands", { r: 1, v: 180, s: 1 }, { fire: 0.1 }),
  knuckles: gear("Gants coqués", "hands", { r: 2, v: 520, s: 1 }, { mel: 0.3 }),
  sniperglv: gear("Gants de tireur d'élite", "hands", { r: 3, v: 1200, s: 1 }, { fire: 0.2, mel: 0.1 }),
  sneakers: gear("Baskets", "feet", { r: 0, v: 50, s: 2 }, { spd: 0.05 }),
  boots: gear("Rangers", "feet", { r: 1, v: 200, s: 2 }, { spd: 0.04, red: 0.04 }),
  trail: gear("Chaussures de trail", "feet", { r: 2, v: 550, s: 2 }, { spd: 0.12 }),
  felt: gear("Bottes feutrées", "feet", { r: 3, v: 1250, s: 2 }, { spd: 0.08, quiet: 0.3 }),
  satchel: gear("Musette", "back", { r: 0, v: 60, s: 2 }, { cap: 2 }),
  daypack: gear("Sac de randonnée", "back", { r: 1, v: 240, s: 2 }, { cap: 4 }),
  milpack: gear("Sac militaire", "back", { r: 2, v: 650, s: 3 }, { cap: 6 }),
  exppack: gear("Sac d'expédition", "back", { r: 3, v: 1400, s: 3 }, { cap: 9 }),
  headlamp: gear("Lampe frontale", "trinket", { r: 1, v: 200, s: 1 }, { vis: 0.3 }),
  medal: gear("Médaille porte-bonheur", "trinket", { r: 1, v: 220, s: 1 }, { hp: 15 }),
  jammer: gear("Brouilleur", "trinket", { r: 2, v: 600, s: 1 }, { quiet: 0.25 }),
  vial: gear("Fiole de sérum", "trinket", { r: 3, v: 1300, s: 1 }, { hp: 30, red: 0.05 }),
  gen1: shield("Bouclier bricolé", { r: 0, v: 90, s: 1 }, [20, 3.5, 15]),
  gen2: shield("Bouclier civil", { r: 1, v: 260, s: 1 }, [35, 3, 20]),
  gen3: shield("Bouclier militaire", { r: 2, v: 720, s: 2 }, [55, 2.5, 30]),
  gen4: shield("Bouclier prototype", { r: 3, v: 1500, s: 2 }, [80, 2, 40]),
} satisfies Record<string, ItemDef>;

export type ItemKey = keyof typeof ITEMS;
export interface Item {
  k: ItemKey;
  u: string;
  lv?: number;
  /** rolled quality, 0.9 to 1.1, on the base stats; absent on unrolled items */
  q?: number;
  /** rolled bonuses on top of the base ones */
  fx?: Mods;
}

const qOf = (it: Item) => it.q ?? 1;
const fxCount = (it: Item) => Object.keys(it.fx || {}).length;

export const KEYS = Object.keys(ITEMS) as ItemKey[];
/** handed out when the player has no weapon; never dropped, never kept */
export const FREE: ItemKey = "knife";
export const SHOP: ItemKey[] = ["p9", "vest1", "gen1", "med"];
export const RAR = ["Commun", "Peu commun", "Rare", "Épique"];

export const def = (k: ItemKey): ItemDef => ITEMS[k];
/** The component an enemy kind drops. */
export const partOf = (kind: Kind) =>
  KEYS.find((k) => {
    const d = def(k);
    return d.t === "part" && d.src === kind;
  }) as ItemKey;
export const isItemKey = (k: unknown): k is ItemKey => typeof k === "string" && k in ITEMS;
export const mk = (k: ItemKey): Item => ({ k, u: uid() });
export const price = (k: ItemKey) => Math.round(def(k).v * 1.6);
/** What the merchant asks for this very piece, its roll included. */
export const priceOf = (it: Item) => Math.round(valOf(it) * 1.6);
export const bagUsed = (b: Item[]) => b.reduce((s, i) => s + def(i.k).s, 0);
export const valOf = (it: Item) => Math.round(def(it.k).v * (1 + 0.3 * (it.lv || 0)) * qOf(it) * (1 + 0.1 * fxCount(it)));
export const nameOf = (it: Item) => def(it.k).n + (it.lv ? " +" + it.lv : "");
export const isBlade = (it: Item) => {
  const d = def(it.k);
  return d.t === "wpn" && !!d.mel;
};
/** The free knife stands in for an empty blade slot. */
export const KNIFE: Item = { k: FREE, u: "free-knife" };
export const slotOf = (it: Item): Slot | null => {
  const d = def(it.k);
  if (d.t === "gear") return d.slot;
  if (d.t === "shield") return "shield";
  if (d.t !== "wpn") return null;
  return d.mel ? "blade" : "gun";
};

/** Can this kind of item go in a slot: weapons, worn gear and shields. */
export const wearable = (k: ItemKey) => slotOf({ k, u: "" }) !== null;

export type Gear = Record<Slot, Item | null>;
export const emptyGear = (): Gear => ({
  head: null,
  body: null,
  hands: null,
  feet: null,
  back: null,
  trinket: null,
  gun: null,
  blade: null,
  shield: null,
});
export const RED_CAP = 0.7;
const MOD_KEYS: (keyof Mods)[] = ["red", "hp", "spd", "cap", "mel", "fire", "vis", "quiet"];
/** Whole-number bonuses: HP and bag places. */
const WHOLE = new Set<keyof Mods>(["hp", "cap"]);

/** The bonuses a piece gives: a worn piece's own, scaled by its rolled quality, plus whatever bonuses it rolled. */
export function modsOf(it: Item): Mods {
  const d = def(it.k),
    m: Mods = {};
  for (const k of MOD_KEYS) {
    const v = (d.t === "gear" ? (d[k] || 0) * qOf(it) : 0) + (it.fx?.[k] || 0);
    if (v) m[k] = WHOLE.has(k) ? Math.round(v) : +v.toFixed(3);
  }
  return m;
}

export function gearStats(g: Gear): Required<Mods> {
  const s: Required<Mods> = { red: 0, hp: 0, spd: 0, cap: 0, mel: 0, fire: 0, vis: 0, quiet: 0 };
  for (const it of Object.values(g)) {
    if (!it) continue;
    const m = modsOf(it);
    for (const k of MOD_KEYS) s[k] += m[k] || 0;
  }
  s.red = Math.min(RED_CAP, +s.red.toFixed(2));
  return s;
}

/** Each bench level adds 15 % to the reserve. */
export function shieldOf(it: Item | null): ShieldStats | null {
  const d = it && def(it.k);
  if (d?.t !== "shield") return null;
  return { pts: Math.round(d.pts * (1 + 0.15 * (it?.lv || 0)) * (it ? qOf(it) : 1)), delay: d.delay, rate: d.rate };
}

export function wstat(it: Item): WeaponStats {
  const d = def(it.k);
  if (d.t !== "wpn") throw new Error(`${it.k} is not a weapon`);
  const lv = it.lv || 0;
  return { ...d, dmg: Math.round(d.dmg * (1 + 0.15 * lv) * qOf(it)), rate: +(d.rate * (1 + 0.1 * lv)).toFixed(1) };
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

/** The rolled bonuses of a weapon or shield, after its own line. */
const extra = (it: Item, line: string) => [line, ...modLines(it.fx || {})].join(" · ");

export function desc(it: Item): string {
  const d = def(it.k);
  if (d.t === "wpn") return extra(it, weaponLine(it));
  if (d.t === "gear") return `${SLOTS[d.slot]} · ${modLines(modsOf(it)).join(" · ")}`;
  const sh = shieldOf(it);
  if (sh) return extra(it, `${sh.pts} pts de bouclier · recharge ${sh.rate}/s après ${fmtRate(sh.delay)} s sans dégâts`);
  if (d.t === "med") return `Rend ${d.heal} PV en ${d.dur} s`;
  if (d.t === "stim") return `+35 % de vitesse pendant ${d.dur} s`;
  if (d.t === "key") return "Ouvre une salle forte";
  if (d.t === "part") return `Composant · ${RAR[d.r]} · contrats de chasse`;
  return RAR[d.r];
}

function weaponLine(it: Item): string {
  const w = wstat(it);
  if (w.mel) return `${w.dmg} dég · ${fmtRate(w.rate)} coups/s · corps à corps, silencieux`;
  return `${w.pel > 1 ? w.pel + "×" : ""}${w.dmg} dég · ${fmtRate(w.rate)} tirs/s · portée ${fmtM(w.range)}`;
}
