import type { Item, WeaponStats } from "./items";

/** Where a gun takes an attachment. */
export type AttSlot = "barrel" | "sight" | "mech";
export const ATT_SLOTS: Record<AttSlot, string> = { barrel: "Canon", sight: "Viseur", mech: "Mécanisme" };

/** Gun stats an attachment changes, as fractions: 0.2 = +20 %. */
export type AttFx = Partial<Record<"dmg" | "rate" | "range" | "spr" | "noise", number>>;

/** Each attachment trades a gain against a drawback; the gain is a rare one's, the drawback the same at every rarity. */
const KINDS = {
  heavy: { n: "Canon lourd", slot: "barrel", gain: { dmg: 0.2 }, cost: { noise: 0.25 } },
  silencer: { n: "Silencieux", slot: "barrel", gain: { noise: -0.5 }, cost: { dmg: -0.1 } },
  long: { n: "Canon long", slot: "barrel", gain: { range: 0.25 }, cost: { rate: -0.1 } },
  reddot: { n: "Point rouge", slot: "sight", gain: { spr: -0.4 }, cost: {} },
  scope: { n: "Lunette", slot: "sight", gain: { range: 0.4, spr: -0.3 }, cost: { rate: -0.15 } },
  laser: { n: "Viseur laser", slot: "sight", gain: { spr: -0.25, rate: 0.1 }, cost: {} },
  spring: { n: "Ressort renforcé", slot: "mech", gain: { rate: 0.2 }, cost: {} },
  bolt: { n: "Culasse lourde", slot: "mech", gain: { dmg: 0.25 }, cost: { rate: -0.15 } },
  trigger: { n: "Détente fine", slot: "mech", gain: { dmg: 0.1, rate: 0.1 }, cost: {} },
} as const satisfies Record<string, { n: string; slot: AttSlot; gain: AttFx; cost: AttFx }>;

type Kind = keyof typeof KINDS;
/** Gain by rarity, common to epic. */
const TIER = [0.6, 0.8, 1, 1.3];
const VAL = [60, 150, 350, 800];

export type AttKey = `${Kind}${0 | 1 | 2 | 3}`;
export interface AttDef {
  n: string;
  t: "att";
  r: number;
  v: number;
  s: number;
  slot: AttSlot;
  fx: AttFx;
}

function attDef(k: Kind, r: number): AttDef {
  const { n, slot, gain, cost } = KINDS[k];
  const fx: AttFx = { ...cost };
  for (const [s, v] of Object.entries(gain) as [keyof AttFx, number][]) fx[s] = +((fx[s] || 0) + v * TIER[r]).toFixed(3);
  return { n, t: "att", r, v: VAL[r], s: 1, slot, fx };
}

export const ATT_ITEMS = Object.fromEntries(
  (Object.keys(KINDS) as Kind[]).flatMap((k) => TIER.map((_, r) => [`${k}${r}`, attDef(k, r)])),
) as Record<AttKey, AttDef>;

/** What this very attachment does: gains scaled by its rolled quality, drawbacks as they are. */
export function attFx(it: Item, d: AttDef): AttFx {
  const q = it.q ?? 1,
    out: AttFx = {};
  const base = KINDS[it.k.slice(0, -1) as Kind];
  for (const [s, v] of Object.entries(d.fx) as [keyof AttFx, number][]) {
    out[s] = s in base.cost ? v : +(v * q).toFixed(3);
  }
  return out;
}

/** A gun's stats with its attachments: their changes add up per stat, then scale the base. */
export function withAtt(w: WeaponStats, fxs: AttFx[]): WeaponStats {
  const sum: AttFx = {};
  for (const fx of fxs) for (const [s, v] of Object.entries(fx) as [keyof AttFx, number][]) sum[s] = (sum[s] || 0) + v;
  const f = (s: keyof AttFx) => 1 + (sum[s] || 0);
  return {
    ...w,
    dmg: Math.round(w.dmg * f("dmg")),
    rate: +(w.rate * f("rate")).toFixed(1),
    range: Math.round(w.range * f("range")),
    spr: +(w.spr * f("spr")).toFixed(3),
    noise: Math.round(w.noise * f("noise")),
  };
}

const pct = (x: number) => `${x > 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)} %`;
const NAMES: Record<keyof AttFx, string> = { dmg: "dégâts", rate: "cadence", range: "portée", spr: "dispersion", noise: "bruit" };

/** One short line per changed stat. */
export const attLines = (fx: AttFx) => (Object.entries(fx) as [keyof AttFx, number][]).map(([s, v]) => `${pct(v)} ${NAMES[s]}`);
