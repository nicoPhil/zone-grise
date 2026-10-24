import { beforeEach, describe, expect, it } from "vitest";
import { mk } from "../src/items";
import { fresh, parseSave, setSave, S } from "../src/state";
import { UNLOCK_AFTER, ZONES, power, unlocked } from "../src/zones";

describe("zones", () => {
  beforeEach(() => setSave(fresh()));

  it("unlock one after another, after enough extractions in the previous one", () => {
    expect([0, 1, 2].map((i) => unlocked(S, i))).toEqual([true, false, false]);
    S.zx = [UNLOCK_AFTER, 0, 0];
    expect([0, 1, 2].map((i) => unlocked(S, i))).toEqual([true, true, false]);
  });

  it("credit pre-zone extractions to the first zone", () => {
    const s = parseSave(JSON.stringify({ credits: 0, stash: [], lo: { w: null, a: null, meds: 0 }, st: { raids: 9, ext: 5, dead: 4, best: 0 } }));
    expect(s.zx).toEqual([5, 0, 0]);
    expect(unlocked(s, 1)).toBe(true);
  });

  it("rate the free knife above the first zone's advice and a geared player above the last", () => {
    expect(power()).toBeGreaterThanOrEqual(ZONES[0].power);
    expect(power()).toBeLessThan(ZONES[1].power);
    S.lo.w = { ...mk("ar"), lv: 2 };
    S.lo.a = mk("vest2");
    S.up.hp = 2;
    expect(power()).toBeGreaterThan(ZONES[2].power);
  });
});
