import { describe, expect, it } from "vitest";
import { type ItemKey, wearable } from "../src/items";

describe("wearable", () => {
  it("lets weapons, worn gear and shields be equipped, not consumables", () => {
    const worn: ItemKey[] = ["p9", "bat", "vest1", "gen1", "gen4"];
    expect(worn.map(wearable)).toEqual([true, true, true, true, true]);
    expect(wearable("med")).toBe(false);
  });
});
