import { describe, expect, it } from "vitest";
import { FREE, mk, upgradeOver } from "../src/items";

describe("upgradeOver", () => {
  const gear = { wpn: mk("p9"), mel: mk(FREE), arm: mk("vest1") };

  it("compares each piece with the slot it would take", () => {
    expect(upgradeOver(mk("ar"), gear)).toBe(true);
    expect(upgradeOver(mk("katana"), gear)).toBe(true);
    expect(upgradeOver(mk("vest2"), gear)).toBe(true);
    expect(upgradeOver(mk("jacket"), gear)).toBe(false);
    expect(upgradeOver({ ...mk("p9"), lv: 1 }, gear)).toBe(true);
    expect(upgradeOver(mk("p9"), gear)).toBe(false);
  });

  it("any gun beats having none, loot never does", () => {
    expect(upgradeOver(mk("p9"), { ...gear, wpn: null })).toBe(true);
    expect(upgradeOver(mk("med"), gear)).toBe(false);
  });
});
