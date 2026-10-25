import { wstat } from "../../src/items";
import { CALL_ZONE, RAID_TIME, heal, type Raid } from "../../src/raid";
import type { Pt } from "../../src/util";
import { los } from "../../src/world/geometry";
import {
  canHeal,
  crateGoal,
  huntGoal,
  leaveReason,
  lockGoal,
  makeRoom,
  nearestExit,
  pickGoal,
  type Goal,
  type Leave,
  type Style,
} from "./goals";
import { Path, Reach } from "./path";
import { pad } from "./stubs/input";

const THINK = 0.25,
  STUCK_WINDOW = 3,
  GIVE_UP = 30;
const STILL: Pt = { x: 0, y: 0 };

/** What the bot did, beyond what the raid itself counts. */
export interface Notes {
  leave: Leave | null;
  /** raid seconds elapsed when it headed out */
  leftAt: number;
  /** where it pushed the stick for STUCK_WINDOW seconds without getting anywhere */
  stuck: Pt[];
  /** goals dropped after GIVE_UP seconds */
  gaveUp: number;
}

/** Plays one raid by pushing the stick and the heal button, as a player would. */
export class Bot {
  notes: Notes = { leave: null, leftAt: 0, stuck: [], gaveUp: 0 };
  private path = new Path();
  private reach = new Reach();
  private goal: Goal | null = null;
  private since = 0;
  private think = 0;
  private skip = new Set<object>();
  private watch = { x: 0, y: 0, t: 0, pushed: 0 };

  constructor(readonly style: Style) {}

  play(r: Raid, dt: number) {
    this.think -= dt;
    this.since += dt;
    if (this.think <= 0 || !this.valid(r)) {
      this.think = THINK;
      this.plan(r);
    }
    if (r.p.hp < r.p.max * 0.55 && r.p.regen <= 0 && canHeal(r)) heal();
    const m = this.move(r);
    [pad.x, pad.y] = [m.x, m.y];
    this.watchStuck(r, m, dt);
  }

  private set(g: Goal | null) {
    if (g?.ref !== this.goal?.ref) this.since = 0;
    this.goal = g;
  }

  private valid(r: Raid): boolean {
    const g = this.goal;
    if (!g) return false;
    if (this.since > GIVE_UP && g.kind !== "exit" && g.kind !== "hold") {
      this.notes.gaveUp++;
      this.skip.add(g.ref);
      return false;
    }
    if (g.kind === "crate") return !(g.ref as { open: boolean }).open;
    if (g.kind === "pick") return r.pick.includes(g.ref as Raid["pick"][number]);
    if (g.kind === "enemy") return r.enemies.includes(g.ref as Raid["enemies"][number]);
    return true;
  }

  private plan(r: Raid) {
    const reach = this.reach.from(r, r.p);
    if (r.call) return this.set({ kind: "hold", at: r.call, ref: r.call });
    const why = this.notes.leave || leaveReason(r, this.style, reach);
    const g = why ? null : this.loot(r, reach);
    if (g) return this.set(g);
    if (!this.notes.leave) [this.notes.leave, this.notes.leftAt] = [why || "plus rien", RAID_TIME - r.t];
    const out = nearestExit(r, reach);
    this.set(out && { kind: "exit", at: out.at, ref: out.at });
  }

  private loot(r: Raid, reach: Reach): Goal | null {
    const s = this.style;
    return (
      pickGoal(r, reach, this.skip) || lockGoal(r, s) || (s.hunts && huntGoal(r, s, reach, this.skip)) || crateGoal(r, s, reach, this.skip)
    );
  }

  /** An enemy on to the bot, in range and in sight. */
  private threat(r: Raid): boolean {
    const p = r.p,
      range = p.eq.gun ? wstat(p.eq.gun).range : 0;
    return r.enemies.some((e) => e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < range && los(r.walls, p, e));
  }

  private standsToFight(r: Raid): boolean {
    const leave = this.notes.leave;
    if (!this.style.fights || !r.p.eq.gun || leave === "temps" || (leave === "PV" && !r.call)) return false;
    return this.threat(r);
  }

  private move(r: Raid): Pt {
    const g = this.goal,
      p = r.p;
    if (!g) return STILL;
    if (this.standsToFight(r)) return STILL;
    const d = Math.hypot(g.at.x - p.x, g.at.y - p.y);
    if (g.kind === "crate" && d < 30) return STILL;
    if (g.kind === "lock" && d < 50) return STILL;
    if (g.kind === "hold" && d < CALL_ZONE * 0.4) return STILL;
    if (g.kind === "enemy" && d < 260 && los(r.walls, p, g.at)) return STILL;
    if (g.kind === "pick" && d < 40 && !makeRoom(r, (g.ref as Raid["pick"][number]).it)) this.skip.add(g.ref);
    return this.path.step(r, g.at);
  }

  private watchStuck(r: Raid, m: Pt, dt: number) {
    const w = this.watch,
      p = r.p;
    w.t += dt;
    if (m.x || m.y) w.pushed += dt;
    if (w.t < STUCK_WINDOW) return;
    if (w.pushed > STUCK_WINDOW * 0.9 && Math.hypot(p.x - w.x, p.y - w.y) < 25) {
      this.notes.stuck.push({ x: Math.round(p.x), y: Math.round(p.y) });
      if (this.goal && this.goal.kind !== "exit" && this.goal.kind !== "hold") this.skip.add(this.goal.ref);
      this.think = 0;
    }
    Object.assign(w, { x: p.x, y: p.y, t: 0, pushed: 0 });
  }
}
