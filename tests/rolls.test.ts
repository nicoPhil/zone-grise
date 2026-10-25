import { afterEach, describe, expect, it, vi } from "vitest";
import { def, emptyGear, gearStats, mk, shieldOf, valOf, wstat } from "../src/items";
import { roll, stars } from "../src/rolls";
import { parseSave, fresh } from "../src/state";
import { stackKey } from "../src/ui/row";
import { rollItem } from "../src/world/mapgen";

afterEach(() => vi.restoreAllMocks());

describe("rolled pieces", () => {
  it("get a quality within ±10 % and one bonus per rarity step, two when epic", () => {
    const pieces = Array.from({ length: 200 }, () => (["beanie", "vest1", "helmet", "armor"] as const).map((k) => roll(mk(k)))).flat();
    for (const it of pieces) {
      expect(it.q).toBeGreaterThanOrEqual(0.9);
      expect(it.q).toBeLessThanOrEqual(1.1);
      expect(Object.keys(it.fx || {})).toHaveLength([0, 1, 1, 2][def(it.k).r]);
    }
    const whole = pieces.flatMap((it) => [it.fx?.hp, it.fx?.cap]).filter((v) => v !== undefined);
    expect(whole.length).toBeGreaterThan(0);
    expect(whole.every(Number.isInteger)).toBe(true);
  });

  it("leave everything that can't be worn as it is", () => {
    const gold = mk("gold");
    expect(roll(gold)).toBe(gold);
    expect(roll(mk("knife")).q).toBeUndefined();
  });

  it("scale damage, shield reserve and worn bonuses by their quality, and add their bonuses", () => {
    expect(wstat({ ...mk("ar"), q: 1.1 }).dmg).toBe(Math.round(17 * 1.1));
    expect(shieldOf({ ...mk("gen3"), q: 0.9 })?.pts).toBe(Math.round(55 * 0.9));
    const s = gearStats({ ...emptyGear(), body: { ...mk("vest2"), q: 1.1, fx: { spd: 0.05 } }, gun: { ...mk("p9"), q: 1, fx: { hp: 8 } } });
    expect(s.red).toBeCloseTo(0.44);
    expect(s.spd).toBeCloseTo(0.05);
    expect(s.hp).toBe(8);
  });

  it("are worth more with a better roll", () => {
    expect(valOf({ ...mk("vest2"), q: 1.1, fx: { spd: 0.05 } })).toBeGreaterThan(valOf(mk("vest2")));
    expect(valOf({ ...mk("vest2"), q: 0.9 })).toBeLessThan(valOf(mk("vest2")));
  });

  it("show 1 star for the worst roll and 5 for the best", () => {
    expect(stars(mk("vest2"))).toBe(0);
    expect(stars({ ...mk("beanie"), q: 0.9 })).toBe(1);
    expect(stars({ ...mk("beanie"), q: 1.1 })).toBe(5);
    expect(stars({ ...mk("armor"), q: 1.1, fx: { spd: 0.06 * 1.2, hp: 18 } })).toBe(5);
  });

  it("each keep their own line in a list, unrolled copies still stack", () => {
    expect(stackKey(mk("med"))).toBe(stackKey(mk("med")));
    expect(stackKey(roll(mk("vest1")))).not.toBe(stackKey(roll(mk("vest1"))));
  });

  it("come out of crates rolled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const it = rollItem(1);
    expect(def(it.k).t).toBe("gear");
    expect(it.q).toBeDefined();
  });

  it("keep their roll through a save", () => {
    const it = { ...mk("vest2"), q: 1.05, fx: { quiet: 0.07 } };
    expect(parseSave(JSON.stringify({ ...fresh(), stash: [it] })).stash).toEqual([it]);
  });
});
