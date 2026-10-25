import { describe, expect, it } from "vitest";
import { FREE, KEYS, def, wstat } from "../src/items";
import { MILITARY_SHIELDS, ROOM_SHIELDS, rollItem } from "../src/world/mapgen";
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
    for (let i = 0; i < 20000; i++) seen.add(rollItem(Math.random(), { shield: 0.05 }).k);
    expect(seen.has(FREE)).toBe(false);
    for (const k of KEYS) {
      if (def(k).t === "part") expect(seen.has(k), k).toBe(false);
      else if (k !== FREE && k !== "vkey" && k !== "key") expect(seen.has(k), k).toBe(true);
    }
    expect(KEYS.filter((k) => def(k).t === "wpn" && wstat({ k, u: "" }).mel).length).toBeGreaterThanOrEqual(5);
  });

  it("finds shield generators in about 5 % of a room crate's items and 15 % of a military crate's", () => {
    const share = (o: Parameters<typeof rollItem>[1]) => {
      let n = 0;
      for (let i = 0; i < 20000; i++) if (def(rollItem(Math.random(), o).k).t === "shield") n++;
      return n / 20000;
    };
    expect(share({ shield: ROOM_SHIELDS })).toBeCloseTo(0.05, 1);
    expect(share({ minR: 1, kit: true, shield: MILITARY_SHIELDS })).toBeCloseTo(0.15, 1);
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
