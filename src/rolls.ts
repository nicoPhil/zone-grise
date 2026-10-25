import { FREE, def, slotOf, type Item, type Mods, type Slot } from "./items";
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
  search: [0.08, 0.18],
  call: [0.08, 0.15],
  step: [0.15, 0.3],
  recharge: [0.1, 0.25],
  dodge: [0.03, 0.07],
};
/** The bonuses each slot can roll, so a pair of boots rolls footwork, not fire rate. */
const POOL: Record<Slot, (keyof Mods)[]> = {
  head: ["red", "hp", "vis", "quiet"],
  body: ["red", "hp", "dodge", "quiet"],
  hands: ["mel", "fire", "search"],
  feet: ["spd", "step", "dodge"],
  back: ["cap", "call", "search"],
  trinket: ["vis", "quiet", "hp", "search", "call"],
  gun: ["fire", "vis"],
  blade: ["mel", "spd"],
  shield: ["recharge", "hp", "red"],
};
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
  const slot = slotOf(it);
  // an attachment rolls only its quality, which scales its gains
  if (def(it.k).t === "att") return { ...it, q: +rnd(Q_MIN, Q_MAX).toFixed(3) };
  if (!slot || it.k === FREE) return it;
  const g = grade(it);
  const keys = [...POOL[slot]].sort(() => Math.random() - 0.5).slice(0, COUNT[def(it.k).r]);
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
