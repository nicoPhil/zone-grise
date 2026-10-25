import { describe, expect, it } from "vitest";
import { FREE, KEYS, def, wstat } from "../src/items";
import { rollItem } from "../src/world/mapgen";
import { MELEE_ARC, frontHit, inArc } from "../src/world/geometry";

describe("melee", () => {
  it("the free kit is a melee weapon", () => {
    expect(wstat({ k: FREE, u: "" }).mel).toBe(true);
  });

  it("hits in front within reach, not behind or beyond", () => {
    expect(inArc({ x: 0, y: 0 }, 0, { x: 30, y: 10 }, { reach: 40, half: MELEE_ARC })).toBe(true);
    expect(inArc({ x: 0, y: 0 }, 0, { x: -30, y: 0 }, { reach: 40, half: MELEE_ARC })).toBe(false);
    expect(inArc({ x: 0, y: 0 }, 0, { x: 60, y: 0 }, { reach: 40, half: MELEE_ARC })).toBe(false);
    // the arc wraps around ±π
    expect(inArc({ x: 0, y: 0 }, Math.PI, { x: -30, y: -1 }, { reach: 40, half: MELEE_ARC })).toBe(true);
  });
});

describe("loot", () => {
  it("crates never drop the free kit nor enemy components, and can drop every other item kind", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(rollItem(Math.random()).k);
    expect(seen.has(FREE)).toBe(false);
    for (const k of KEYS) {
      if (def(k).t === "part") expect(seen.has(k), k).toBe(false);
      else if (k !== FREE && k !== "vkey" && k !== "key") expect(seen.has(k), k).toBe(true);
    }
    expect(KEYS.filter((k) => def(k).t === "wpn" && wstat({ k, u: "" }).mel).length).toBeGreaterThanOrEqual(5);
  });
});

describe("shield", () => {
  it("stops bullets coming at its front and lets those from behind or the side through", () => {
    // the shield faces +x (toward a player on its right)
    expect(frontHit(0, -400, 0)).toBe(true);
    expect(frontHit(0, 400, 0)).toBe(false);
    expect(frontHit(0, 0, 400)).toBe(false);
    expect(frontHit(Math.PI / 2, 0, -400)).toBe(true);
  });
});
