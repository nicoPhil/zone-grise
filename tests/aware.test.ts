import { describe, expect, it } from "vitest";
import { LOSE_TIME, SEARCH_TIME, alert, hear, inCone, suspicious, track, watch, type Awareness } from "../src/aware";

const idle = (): Awareness => ({ aggro: false, lx: 0, ly: 0, lost: 0, sr: 0, al: 0, sus: 0 });
const run = (e: Awareness, see: boolean, secs: number, p = { x: 500, y: 0 }) => {
  for (let t = 0; t < secs; t += 0.1) track(e, see, p, 0.1);
};
const stare = (e: Awareness, d: number, secs: number, view = true) => {
  for (let t = 0; t < secs; t += 0.05) watch(e, view, d, 200, { x: d, y: 0 }, 0.05);
};

describe("enemy awareness", () => {
  it("sees in front within range, and only feels what is close behind", () => {
    const e = { x: 0, y: 0 };
    expect(inCone(0, e, { x: 150, y: 20 }, 200, 0.8)).toBe(true);
    expect(inCone(0, e, { x: 250, y: 0 }, 200, 0.8)).toBe(false);
    expect(inCone(0, e, { x: -150, y: 0 }, 200, 0.8)).toBe(false);
    expect(inCone(0, e, { x: -40, y: 0 }, 200, 0.8)).toBe(true);
  });

  it("is only suspicious at a glance, and spots the player who stays in view", () => {
    const e = idle();
    stare(e, 180, 0.3);
    expect(e.aggro).toBe(false);
    expect(suspicious(e)).toBe(true);
    stare(e, 180, 0.3, false);
    expect(e.aggro).toBe(false);
    stare(e, 180, 1.2);
    expect(e.aggro).toBe(true);
  });

  it("spots faster up close", () => {
    const near = idle(), far = idle();
    stare(near, 40, 0.4);
    stare(far, 190, 0.4);
    expect(near.aggro).toBe(true);
    expect(far.aggro).toBe(false);
  });

  it("goes to check a noise without hunting", () => {
    const e = idle();
    hear(e, 300, 40);
    expect(e).toMatchObject({ aggro: false, lx: 300, ly: 40 });
    expect(suspicious(e)).toBe(true);
  });

  it("loses the trail out of sight, searches the last seen point, then gives up", () => {
    const e = idle();
    alert(e, 100, 50);
    run(e, true, 1, { x: 120, y: 60 });
    run(e, false, LOSE_TIME - 0.5);
    expect(e.aggro).toBe(true);
    run(e, false, 1);
    expect(e).toMatchObject({ aggro: false, lx: 120, ly: 60 });
    run(e, false, SEARCH_TIME);
    expect(suspicious(e)).toBe(false);
  });

  it("keeps hunting while the player keeps making noise", () => {
    const e = idle();
    alert(e, 0, 0);
    for (let i = 0; i < 10; i++) {
      run(e, false, LOSE_TIME - 1);
      hear(e, i, 0);
    }
    expect(e.aggro).toBe(true);
  });
});
