import { beforeEach, describe, expect, it } from "vitest";
import { mk } from "../src/items";
import { report } from "../src/report";
import { S, fresh, setSave } from "../src/state";

beforeEach(() => setSave(fresh()));

describe("share report", () => {
  it("lists the worn pieces with their roll and one line per logged raid", () => {
    S.lo.eq.gun = { ...mk("ar"), lv: 1, q: 1.05, fx: { fire: 0.08 } };
    const raid = {
      n: 7,
      z: 2,
      ok: false,
      t: 95,
      val: 1200,
      kills: 4,
      boss: 1,
      vaults: 0,
      violet: 2,
      deep: 2,
      dmg: 140,
      hp: 0,
      pw: 90,
      cr: 300,
      sv: 800,
    };
    S.log.push(raid);
    const text = report("abc", new Date("2026-10-25T12:00:00Z"));
    expect(text).toContain("- gun : Fusil d'assaut +1 [r2]");
    expect(text).toContain("q1.05 (fire 0.08)");
    expect(text.split("\n").at(-1)).toBe("7;Cœur;mort;1:35;1200;4;1;0;2;Cœur;140;0;90;300;800;;;");
  });
});
