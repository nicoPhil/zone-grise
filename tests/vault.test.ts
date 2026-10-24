import { describe, expect, it } from "vitest";
import { genMap } from "../src/world/mapgen";
import { floodFromOutside, pickVault, reachable } from "../src/world/vault";

describe("vault", () => {
  it("is sealed while locked, opens once unlocked, and never cuts off another room", () => {
    let found = 0;
    for (let m = 0; m < 30; m++) {
      const { walls, bld } = genMap();
      const plan = pickVault(walls, bld);
      if (!plan) continue;
      found++;
      const locked = floodFromOutside([...walls, ...plan.locks]);
      expect(reachable(locked, plan.room)).toBe(false);
      for (const b of bld) for (const r of b.rooms) if (r !== plan.room) expect(reachable(locked, r)).toBe(true);
      expect(reachable(floodFromOutside(walls), plan.room)).toBe(true);
    }
    // nearly every map has a multi-room central building to host one
    expect(found).toBeGreaterThan(25);
  });
});
