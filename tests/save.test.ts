import { beforeEach, describe, expect, it } from "vitest";
import { applyRaid, norm, qInfo } from "../src/progression";
import { S, fresh, parseSave, setSave } from "../src/state";

describe("parseSave", () => {
  it("upgrades a save written before upgrades and contracts existed", () => {
    const old = { credits: 900, stash: [{ k: "hdd", u: "a" }], lo: { w: { k: "p9", u: "w" }, a: null, meds: 2 }, st: { raids: 4, ext: 2, dead: 2, best: 300 } };
    const s = parseSave(JSON.stringify(old));
    expect(s.up).toEqual({ bag: 0, meds: 0, hp: 0 });
    expect(s.q).toEqual([]);
    expect(s.credits).toBe(900);
    expect(s.lo.w?.k).toBe("p9");
  });

  it("drops items whose key no longer exists", () => {
    const s = parseSave(JSON.stringify({ ...fresh(), stash: [{ k: "hdd", u: "a" }, { k: "laser", u: "b" }], lo: { w: { k: "laser", u: "w" }, a: null, meds: 0 } }));
    expect(s.stash.map((i) => i.k)).toEqual(["hdd"]);
    expect(s.lo.w).toBeNull();
  });

  it("starts fresh on garbage", () => {
    expect(parseSave("{not json")).toEqual(fresh());
    expect(parseSave(null)).toEqual(fresh());
  });
});

describe("contracts", () => {
  beforeEach(() => setSave(fresh()));

  it("keeps three contracts on offer", () => {
    norm();
    expect(S.q).toHaveLength(3);
  });

  it("credits kills, violet crates and haul only through applyRaid", () => {
    S.q = [
      { u: "k", t: "kills", n: 4, have: 1, cr: 180 },
      { u: "v", t: "violet", n: 2, have: 0, cr: 520 },
      { u: "h", t: "haul", n: 600, have: 0, cr: 300 },
    ];
    const done = applyRaid(3, 1, 650);
    expect(done.map((q) => q.u)).toEqual(["k", "h"]);
    expect(qInfo(S.q[1])).toMatchObject({ h: 1, done: false });
  });
});
