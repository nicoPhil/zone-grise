import { describe, expect, it } from "vitest";
import { FREE, KEYS, def, wstat } from "../src/items";
import { rollItem } from "../src/world/mapgen";
import { MELEE_ARC, frontHit, inArc } from "../src/world/geometry";

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
