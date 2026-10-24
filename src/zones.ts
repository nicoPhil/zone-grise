import { FREE, armorRed, wstat, type Item } from "./items";
import { maxHp } from "./progression";
import { S, type Save } from "./state";
import { clamp } from "./util";

export interface Zone {
  name: string;
  blurb: string;
  /** map depth 0..1 is remapped to lo..lo+span for loot and enemy mix */
  lo: number;
  span: number;
  hp: number;
  dmg: number;
  enemies: number;
  wave: number;
  vault: boolean;
  boss: boolean;
  power: number;
}

export const ZONES: Zone[] = [
  { name: "Faubourgs", blurb: "Zombies et meutes, loot modeste", lo: 0, span: 0.55, hp: 1, dmg: 1, enemies: 12, wave: 22, vault: false, boss: false, power: 20 },
  { name: "Zone industrielle", blurb: "Soldats, salle forte, loot rare", lo: 0.25, span: 0.6, hp: 1.6, dmg: 1.5, enemies: 16, wave: 18, vault: true, boss: false, power: 70 },
  { name: "Cœur", blurb: "La Brute, loot épique", lo: 0.5, span: 0.5, hp: 2.3, dmg: 2, enemies: 20, wave: 14, vault: true, boss: true, power: 140 },
];
export const UNLOCK_AFTER = 3;

export const zoneDepth = (z: Zone, d: number) => clamp(z.lo + z.span * d, 0, 1);
export const unlocked = (s: Save, i: number) => i === 0 || s.zx[i - 1] >= UNLOCK_AFTER;

/** One number for "how strong am I": the best weapon's damage per second, scaled by armour and max HP. */
export function power(s: Save = S): number {
  const dps = (it: Item) => {
    const w = wstat(it);
    return w.dmg * w.pel * w.rate;
  };
  const best = Math.max(dps(s.lo.m || { k: FREE, u: "" }), s.lo.w ? dps(s.lo.w) : 0);
  return Math.round((best / (1 - armorRed(s.lo.a))) * (maxHp() / 100));
}
