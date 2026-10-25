import { KNIFE, dps, gearStats } from "./items";
import { maxHp } from "./progression";
import { S, type Save } from "./state";
import { clamp } from "./util";
import type { Kind } from "./raid";

export interface Zone {
  name: string;
  blurb: string;
  /** map depth 0..1 is remapped to lo..lo+span for loot and enemy mix; past 1 only the loot keeps improving */
  lo: number;
  span: number;
  hp: number;
  dmg: number;
  enemies: number;
  wave: number;
  vault: boolean;
  boss: boolean;
  power: number;
  /** enemy kinds this zone adds to walkers, runners and gunners */
  adds: Kind[];
}

export const ZONES: Zone[] = [
  {
    name: "Faubourgs",
    blurb: "Zombies et meutes, loot modeste",
    lo: 0,
    span: 0.55,
    hp: 1,
    dmg: 1,
    enemies: 12,
    wave: 22,
    vault: false,
    boss: false,
    power: 20,
    adds: [],
  },
  {
    name: "Zone industrielle",
    blurb: "Soldats, gonflés, salle forte, loot rare",
    lo: 0.25,
    span: 0.6,
    hp: 1.6,
    dmg: 1.5,
    enemies: 16,
    wave: 18,
    vault: true,
    boss: false,
    power: 70,
    adds: ["bloat"],
  },
  {
    name: "Cœur",
    blurb: "La Brute, mitrailleurs, loot épique",
    lo: 0.5,
    span: 0.5,
    hp: 2.3,
    dmg: 2,
    enemies: 20,
    wave: 14,
    vault: true,
    boss: true,
    power: 140,
    adds: ["bloat", "smg"],
  },
  {
    name: "Quarantaine",
    blurb: "Snipers, boucliers, une Brute plus coriace, épique fréquent",
    lo: 0.7,
    span: 0.45,
    hp: 3.2,
    dmg: 2.6,
    enemies: 24,
    wave: 11,
    vault: true,
    boss: true,
    power: 300,
    adds: ["bloat", "smg", "sniper", "shield"],
  },
  {
    name: "Épicentre",
    blurb: "Traqueurs invisibles, chefs de meute, le meilleur loot",
    lo: 0.9,
    span: 0.5,
    hp: 4.5,
    dmg: 3.3,
    enemies: 28,
    wave: 9,
    vault: true,
    boss: true,
    power: 550,
    adds: ["bloat", "smg", "sniper", "shield", "stalker", "alpha"],
  },
];
export const UNLOCK_AFTER = 3;

export const zoneDepth = (z: Zone, d: number) => clamp(z.lo + z.span * d, 0, 1.4);
export const unlocked = (s: Save, i: number) => i === 0 || s.zx[i - 1] >= UNLOCK_AFTER;

/** One number for "how strong am I": the best weapon's damage per second with its gear bonus, scaled by damage reduction and max HP. */
export function power(s: Save = S): number {
  const g = s.lo.eq,
    st = gearStats(g);
  const best = Math.max(dps(g.blade || KNIFE) * (1 + st.mel), g.gun ? dps(g.gun) * (1 + st.fire) : 0);
  return Math.round((best / (1 - st.red)) * ((maxHp() + st.hp) / 100));
}
