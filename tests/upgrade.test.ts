import { describe, expect, it } from "vitest";
import { emptyGear, gearStats, mk, slotOf, upgradeOver } from "../src/items";

describe("gear", () => {
  const gear = { ...emptyGear(), gun: mk("p9"), body: mk("vest1") };

  it("puts every weapon and wearable in its own slot", () => {
    expect([mk("p9"), mk("bat"), mk("vest1"), mk("helmet"), mk("exppack"), mk("med")].map(slotOf)).toEqual(["gun", "blade", "body", "head", "back", null]);
  });

  it("compares a piece with the one in the slot it would take", () => {
    expect(upgradeOver(mk("ar"), gear)).toBe(true);
    expect(upgradeOver(mk("katana"), gear)).toBe(true);
    expect(upgradeOver(mk("vest2"), gear)).toBe(true);
    expect(upgradeOver(mk("jacket"), gear)).toBe(false);
    expect(upgradeOver({ ...mk("p9"), lv: 1 }, gear)).toBe(true);
    expect(upgradeOver(mk("p9"), gear)).toBe(false);
    expect(upgradeOver(mk("beanie"), gear)).toBe(true);
    expect(upgradeOver(mk("med"), gear)).toBe(false);
  });

  it("adds up bonuses across slots and caps damage reduction", () => {
    const s = gearStats({ ...emptyGear(), body: mk("armor"), head: mk("visor"), trinket: mk("vial"), back: mk("daypack") });
    expect(s.red).toBe(0.7);
    expect(s.cap).toBe(4);
    expect(s.vis).toBeCloseTo(0.15);
    expect(gearStats({ ...emptyGear(), body: mk("armor"), head: mk("visor"), trinket: mk("vial"), feet: mk("boots"), hands: mk("knuckles") }).red).toBe(0.7);
  });
});
