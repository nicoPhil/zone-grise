import type { Raid } from "../../src/raid";
import type { Pt } from "../../src/util";
import { G, GW, cellOf, flowDir, updFlow, type Nav } from "../../src/world/nav";

/** Walking distance on the nav grid, in px, from wherever `from` was last set; -1 out of reach. */
export class Reach {
  dist = new Int16Array(GW * GW);
  from(r: Raid, at: Pt) {
    updFlow(r.nav, at.x, at.y, this.dist);
    return this;
  }
  to(at: Pt): number {
    const d = this.dist[cellOf(at.x, at.y)];
    return d < 0 ? -1 : d * G;
  }
}

/** A flow field to one target, rebuilt when the target moves or the walls change (the vault opening). */
export class Path {
  private dist = new Int16Array(GW * GW);
  private at: Pt | null = null;
  private nav: Nav | null = null;

  step(r: Raid, to: Pt): Pt {
    const p = r.p,
      dx = to.x - p.x,
      dy = to.y - p.y,
      d = Math.hypot(dx, dy) || 1;
    if (this.nav !== r.nav || !this.at || Math.hypot(this.at.x - to.x, this.at.y - to.y) > G) {
      updFlow(r.nav, to.x, to.y, this.dist);
      [this.at, this.nav] = [{ ...to }, r.nav];
    }
    // the last cell: walk straight in
    if (d < G * 1.5) return { x: dx / d, y: dy / d };
    return flowDir(r.nav, p.x, p.y, this.dist) || { x: dx / d, y: dy / d };
  }
}
