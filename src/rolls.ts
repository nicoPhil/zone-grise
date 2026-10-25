import { FREE, def, wearable, type Item, type Mods } from "./items";
import { rnd } from "./util";

/** Range of each bonus a piece can roll, for a common piece; rarer pieces roll up to 1.2× more. */
const FX: Record<keyof Mods, [number, number]> = {
  red: [0.02, 0.05],
  hp: [5, 15],
  spd: [0.03, 0.06],
  cap: [1, 2],
  mel: [0.05, 0.15],
  fire: [0.04, 0.1],
  vis: [0.05, 0.15],
  quiet: [0.05, 0.12],
};
const KEYS = Object.keys(FX) as (keyof Mods)[];
/** Bonuses rolled by rarity: none on a common piece, two on an epic one. */
const COUNT = [0, 1, 1, 2];
const Q_MIN = 0.9,
  Q_MAX = 1.1;

const grade = (it: Item) => 0.6 + 0.2 * def(it.k).r;

function bonus(k: keyof Mods, g: number): number {
  const [a, b] = FX[k];
  const v = rnd(a, b) * g;
  return k === "hp" || k === "cap" ? Math.max(1, Math.round(v)) : +v.toFixed(3);
}

/** Gives a weapon, a worn piece or a shield its rolled quality and bonuses; other items come back as they are. */
export function roll(it: Item): Item {
  if (!wearable(it.k) || it.k === FREE) return it;
  const g = grade(it);
  const keys = [...KEYS].sort(() => Math.random() - 0.5).slice(0, COUNT[def(it.k).r]);
  return {
    ...it,
    q: +rnd(Q_MIN, Q_MAX).toFixed(3),
    ...(keys.length && { fx: Object.fromEntries(keys.map((k) => [k, bonus(k, g)])) }),
  };
}

/** 1 to 5 stars: how good the roll is, from its quality and how close each bonus came to its top; 0 when unrolled. */
export function stars(it: Item): number {
  if (it.q === undefined) return 0;
  const g = grade(it);
  const parts = [
    (it.q - Q_MIN) / (Q_MAX - Q_MIN),
    ...Object.entries(it.fx || {}).map(([k, v]) => {
      const [a, b] = FX[k as keyof Mods];
      return ((v || 0) / g - a) / (b - a);
    }),
  ];
  const avg = parts.reduce((s, x) => s + Math.min(1, Math.max(0, x)), 0) / parts.length;
  return 1 + Math.round(4 * avg);
}
