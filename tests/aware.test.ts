import { describe, expect, it } from "vitest";
import { LOSE_TIME, SEARCH_TIME, WAVE_HUNT, alert, track, type Awareness } from "../src/aware";

const idle = (): Awareness => ({ aggro: false, lx: 0, ly: 0, lost: 0, sr: 0, al: 0 });
const run = (e: Awareness, see: boolean, secs: number, p = { x: 500, y: 0 }) => {
  for (let t = 0; t < secs; t += 0.1) track(e, see, p, 0.1);
};

describe("enemy awareness", () => {
  it("loses the trail out of sight, searches the last seen point, then gives up", () => {
    const e = idle();
    alert(e, 100, 50);
    run(e, true, 1, { x: 120, y: 60 });
    run(e, false, LOSE_TIME - 0.5);
    expect(e.aggro).toBe(true);
    run(e, false, 1);
    expect(e).toMatchObject({ aggro: false, lx: 120, ly: 60 });
    expect(e.sr).toBeGreaterThan(0);
    run(e, false, SEARCH_TIME);
    expect(e.sr).toBeLessThanOrEqual(0);
  });

  it("keeps hunting while the player is in sight or keeps making noise", () => {
    const e = idle();
    alert(e, 0, 0);
    for (let i = 0; i < 10; i++) {
      run(e, false, LOSE_TIME - 1);
      alert(e, i, 0);
    }
    expect(e.aggro).toBe(true);
  });

  it("a wave hunter keeps a longer trail, and noise does not shorten it", () => {
    const e = idle();
    alert(e, 0, 0);
    e.lost = -WAVE_HUNT;
    alert(e, 10, 0);
    run(e, false, WAVE_HUNT + LOSE_TIME - 0.5);
    expect(e.aggro).toBe(true);
  });
});
