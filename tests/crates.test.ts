import { describe, expect, it } from "vitest";
import { nearestInReach } from "../src/world/geometry";

describe("crates", () => {
  it("only the nearest closed crate in reach is being opened", () => {
    const a = { x: 30, y: 0, open: false },
      b = { x: 10, y: 0, open: false },
      far = { x: 200, y: 0, open: false };
    expect(nearestInReach([a, b, far], { x: 0, y: 0 }, 48)).toBe(b);
    b.open = true;
    expect(nearestInReach([a, b, far], { x: 0, y: 0 }, 48)).toBe(a);
    a.open = true;
    expect(nearestInReach([a, b, far], { x: 0, y: 0 }, 48)).toBeUndefined();
  });
});
