import { overlaps, type Rect } from "../util";
import { depth, type Building } from "./mapgen";
import { G, cellOf, makeNav, updFlow, type Nav } from "./nav";

export interface VaultPlan {
  b: Building;
  room: Rect;
  locks: Rect[];
}

export function roomCells(r: Rect): number[] {
  const out: number[] = [];
  for (let y = r.y + 10; y < r.y + r.h - 10; y += G) for (let x = r.x + 10; x < r.x + r.w - 10; x += G) out.push(cellOf(x, y));
  return out;
}

/** Flood from a map corner, which genMap always leaves free. */
export function floodFromOutside(walls: Rect[]): Nav {
  const nav = makeNav(walls);
  updFlow(nav, 60, 60);
  return nav;
}
export const reachable = (nav: Nav, r: Rect) => roomCells(r).some((c) => !nav.blocked[c] && nav.dist[c] >= 0);

/**
 * Picks a room in one of the most central buildings and the doors that seal it,
 * such that locking them leaves every other room reachable.
 */
export function pickVault(walls: Rect[], bld: Building[]): VaultPlan | null {
  const central = bld
    .filter((b) => b.rooms.length >= 2)
    .sort((a, b) => depth(b.x + b.w / 2, b.y + b.h / 2) - depth(a.x + a.w / 2, a.y + a.h / 2))
    .slice(0, 4);
  for (const b of central)
    for (const room of [...b.rooms].sort(() => Math.random() - 0.5)) {
      const locks = b.doors.filter((d) => overlaps(d, room, 2));
      if (!locks.length) continue;
      const nav = floodFromOutside([...walls, ...locks]);
      if (reachable(nav, room)) continue;
      if (bld.every((o) => o.rooms.every((r) => r === room || reachable(nav, r)))) return { b, room, locks };
    }
  return null;
}
