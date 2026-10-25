import { beforeEach, describe, expect, it } from "vitest";
import { mk } from "../src/items";
import { fresh, parseSave, setSave, S } from "../src/state";
import { UNLOCK_AFTER, ZONES, extractedIn, power, unlocked, zoneDepth } from "../src/zones";

describe("zones", () => {
  beforeEach(() => setSave(fresh()));

  it("unlock one after another, after enough extractions in the previous one", () => {
    expect([0, 1, 2].map((i) => unlocked(S, i))).toEqual([true, false, false]);
    const opened = Array.from({ length: UNLOCK_AFTER }, () => extractedIn(S, 0));
    expect(opened.at(-1)).toBe(ZONES[1].name);
    expect(opened.slice(0, -1).every((n) => n === "")).toBe(true);
    expect([0, 1, 2].map((i) => unlocked(S, i))).toEqual([true, true, false]);
    expect(extractedIn(S, 0)).toBe("");
  });

  it("keep open the zones an older save opened after 3 extractions", () => {
    const s = parseSave(JSON.stringify({ ...fresh(), opened: undefined, zx: [4, 3, 0, 0, 0] }));
    expect(s.opened).toBe(2);
  });

  it("credit pre-zone extractions to the first zone", () => {
    const s = parseSave(
      JSON.stringify({ credits: 0, stash: [], lo: { w: null, a: null, meds: 0 }, st: { raids: 9, ext: 5, dead: 4, best: 0 } }),
    );
    expect(s.zx).toEqual([5, 0, 0, 0, 0]);
    expect(unlocked(s, 1)).toBe(true);
  });

  it("track extractions for every zone, including saves from before the last zones existed", () => {
    expect(fresh().zx).toHaveLength(ZONES.length);
    const s = parseSave(JSON.stringify({ ...fresh(), zx: [3, 3, 1] }));
    expect(s.zx).toEqual([3, 3, 1, 0, 0]);
    expect(unlocked(s, 3)).toBe(false);
  });

  it("ask for more power and give deeper loot zone after zone", () => {
    for (let i = 1; i < ZONES.length; i++) {
      expect(ZONES[i].power).toBeGreaterThan(ZONES[i - 1].power);
      expect(ZONES[i].hp).toBeGreaterThan(ZONES[i - 1].hp);
      expect(zoneDepth(ZONES[i], 1)).toBeGreaterThan(zoneDepth(ZONES[i - 1], 1));
    }
  });

  it("rate the free knife above the first zone's advice and a geared player above the Cœur", () => {
    expect(power()).toBeGreaterThanOrEqual(ZONES[0].power);
    expect(power()).toBeLessThan(ZONES[1].power);
    S.lo.eq.gun = { ...mk("ar"), lv: 2 };
    S.lo.eq.body = mk("vest2");
    S.up.hp = 2;
    expect(power()).toBeGreaterThan(ZONES[2].power);
  });
});
