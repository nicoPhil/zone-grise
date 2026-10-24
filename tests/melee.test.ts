import { describe, expect, it } from "vitest";
import { FREE, KEYS, def, wstat } from "../src/items";
import { rollItem } from "../src/world/mapgen";
import { MELEE_ARC, inArc } from "../src/world/geometry";

describe("melee", () => {
  it("the free kit is a melee weapon", () => {
    expect(wstat({ k: FREE, u: "" }).mel).toBe(true);
  });

  it("hits in front within reach, not behind or beyond", () => {
    expect(inArc(0, 0, 0, 30, 10, 40, MELEE_ARC)).toBe(true);
    expect(inArc(0, 0, 0, -30, 0, 40, MELEE_ARC)).toBe(false);
    expect(inArc(0, 0, 0, 60, 0, 40, MELEE_ARC)).toBe(false);
    // the arc wraps around ±π
    expect(inArc(0, 0, Math.PI, -30, -1, 40, MELEE_ARC)).toBe(true);
  });
});

describe("loot", () => {
  it("never drops the free kit and can drop every other item kind", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(rollItem(Math.random()).k);
    expect(seen.has(FREE)).toBe(false);
    for (const k of KEYS) if (k !== FREE && k !== "vkey" && k !== "key") expect(seen.has(k), k).toBe(true);
    expect(KEYS.filter((k) => def(k).t === "wpn" && wstat({ k, u: "" }).mel).length).toBeGreaterThanOrEqual(5);
  });
});
