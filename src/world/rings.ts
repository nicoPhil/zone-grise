import { depth } from "./mapgen";

export const RINGS = [
  { n: "Périphérie", msg: "calme, loot modeste" },
  { n: "Zone chaude", msg: "meilleur loot, plus d'ennemis" },
  { n: "Cœur", msg: "le meilleur loot, le plus dangereux" },
] as const;

export const CORE = RINGS.length - 1;

/** Map depth where each ring past the first starts. */
const FROM = [0.42, 0.72];
/** Depth to go past a ring line before it counts as crossed, so walking along it doesn't flicker. */
const SLACK = 0.02;

const ringOf = (d: number) => FROM.filter((f) => d >= f).length;

/** The ring at (x, y) for a player currently in ring `cur`. */
export function ringAt(x: number, y: number, cur: number) {
  const d = depth(x, y),
    n = ringOf(d);
  if (n === cur) return cur;
  return ringOf(n > cur ? d - SLACK : d + SLACK) === n ? n : cur;
}
