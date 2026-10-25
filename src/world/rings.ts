import { DEPTH_R, depth } from "./mapgen";

export const RINGS = [{ n: "Périphérie" }, { n: "Zone chaude" }, { n: "Cœur" }] as const;

export const CORE = RINGS.length - 1;

/** Map depth where each ring past the first starts. */
const FROM = [0.42, 0.72];
/** Depth to go past a ring line before it counts as crossed, so walking along it doesn't flicker. */
const SLACK = 0.02;

/** Distance from the centre of each ring line, outermost first. */
export const RING_R = FROM.map((f) => (1 - f) * DEPTH_R);

/** Enemy HP and damage multiplier in each ring, on top of the zone's. */
export const RING_POW = [1, 1.4, 2];
/** Share of a zone's enemies placed in each ring at the start of a raid. */
export const RING_SHARE = [0.2, 0.35, 0.45];

const byDepth = (d: number) => FROM.filter((f) => d >= f).length;
export const ringOf = (x: number, y: number) => byDepth(depth(x, y));

/** The ring at (x, y) for a player currently in ring `cur`. */
export function ringAt(x: number, y: number, cur: number) {
  const d = depth(x, y),
    n = byDepth(d);
  if (n === cur) return cur;
  return byDepth(n > cur ? d - SLACK : d + SLACK) === n ? n : cur;
}
