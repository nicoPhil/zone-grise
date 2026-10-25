import { describe, expect, it } from "vitest";
import { collide, inWall } from "../src/world/geometry";
import { EDGE, ENTRY_EXIT_D, ENTRY_VAULT_D, H, W, genMap, placeEntries } from "../src/world/mapgen";
import { pickVault } from "../src/world/vault";
import { G, cellOf, flowDir, makeNav, updFlow } from "../src/world/nav";

const MAPS = 40;

describe("generated buildings", () => {
  it("leave every room reachable from outside", () => {
    for (let m = 0; m < MAPS; m++) {
      const { walls, bld } = genMap();
      const nav = makeNav(walls);
      updFlow(nav, 60, 60);
      for (const b of bld)
        for (const r of b.rooms) {
          let reachable = false;
          for (let y = r.y + 10; y < r.y + r.h - 10; y += G)
            for (let x = r.x + 10; x < r.x + r.w - 10; x += G) {
              const c = cellOf(x, y);
              if (!nav.blocked[c] && nav.dist[c] >= 0) reachable = true;
            }
          expect(reachable, `map ${m}, room at ${Math.round(r.x)},${Math.round(r.y)}`).toBe(true);
        }
    }
  });

  it("let a chaser walk out of a room to a player outside", () => {
    for (let m = 0; m < 10; m++) {
      const { walls, bld } = genMap();
      const nav = makeNav(walls);
      for (const b of bld) {
        const target = { x: b.x + b.w / 2, y: b.y + b.h + 150 };
        if (target.y > H - 60 || inWall(walls, target.x, target.y, 14)) continue;
        updFlow(nav, target.x, target.y);
        const room = b.rooms[b.rooms.length - 1];
        const e = { x: room.x + room.w / 2, y: room.y + room.h / 2 };
        let steps = 0;
        // 118 px/s at 60 fps, 25 s budget: same speed and patience as an aggro zombie
        while (Math.hypot(e.x - target.x, e.y - target.y) > 40 && steps++ < 60 * 25) {
          const d = flowDir(nav, e.x, e.y) || { x: target.x - e.x, y: target.y - e.y };
          const l = Math.hypot(d.x, d.y) || 1;
          e.x += (d.x / l) * 2;
          e.y += (d.y / l) * 2;
          collide(walls, e, 14);
        }
        expect(Math.hypot(e.x - target.x, e.y - target.y)).toBeLessThanOrEqual(40);
      }
    }
  });
});

describe("raid entry", () => {
  it("is on the map edge, far from the vault, with both exits across the map", () => {
    for (let m = 0; m < MAPS; m++) {
      const { walls, bld } = genMap();
      const plan = pickVault(walls, bld),
        vault = plan && { x: plan.room.x + plan.room.w / 2, y: plan.room.y + plan.room.h / 2 };
      const { sp, exits } = placeEntries(walls, bld, vault);
      expect(Math.min(sp.x, sp.y, W - sp.x, H - sp.y), `map ${m}`).toBeLessThan(EDGE);
      if (vault) expect(Math.hypot(sp.x - vault.x, sp.y - vault.y)).toBeGreaterThan(ENTRY_VAULT_D);
      for (const e of exits) expect(Math.hypot(sp.x - e.x, sp.y - e.y), `map ${m}`).toBeGreaterThan(ENTRY_EXIT_D);
    }
  });
});
