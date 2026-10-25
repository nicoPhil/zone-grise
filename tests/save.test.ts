import { beforeEach, describe, expect, it } from "vitest";
import { applyRaid, norm, qInfo } from "../src/progression";
import { LOG_MAX, S, fresh, parseSave, resetSave, setSave } from "../src/state";

describe("parseSave", () => {
  it("upgrades a save written before upgrades and contracts existed", () => {
    const old = {
      credits: 900,
      stash: [{ k: "hdd", u: "a" }],
      lo: { w: { k: "p9", u: "w" }, a: null, meds: 2 },
      st: { raids: 4, ext: 2, dead: 2, best: 300 },
    };
    const s = parseSave(JSON.stringify(old));
    expect(s.up).toEqual({ bag: 0, meds: 0, hp: 0 });
    expect(s.q).toEqual([]);
    expect(s.credits).toBe(900);
    expect(s.lo.eq.gun?.k).toBe("p9");
  });

  it("gives a save from before the stations none built and an empty merchant stock", () => {
    const { sta, stock, ...old } = fresh();
    const s = parseSave(JSON.stringify(old));
    expect(s.sta).toEqual({ bench: 0, pocket: 0, trade: 0 });
    expect(s.stock).toEqual({ raid: -1, items: [] });
    expect(sta && stock).toBeTruthy();
  });

  it("keeps the merchant's stock and each piece's roll", () => {
    const stock = { raid: 4, items: [{ k: "vest2", u: "s", q: 0.95, fx: { spd: 0.04 } }] };
    expect(parseSave(JSON.stringify({ ...fresh(), stock })).stock).toEqual(stock);
  });

  it("drops items whose key no longer exists", () => {
    const s = parseSave(
      JSON.stringify({
        ...fresh(),
        stash: [
          { k: "hdd", u: "a" },
          { k: "laser", u: "b" },
        ],
        lo: { w: { k: "laser", u: "w" }, a: null, meds: 0 },
      }),
    );
    expect(s.stash.map((i) => i.k)).toEqual(["hdd"]);
    expect(s.lo.eq.gun).toBeNull();
  });

  it("keeps a worn shield, and gives a save from before shields an empty shield slot", () => {
    const worn = parseSave(JSON.stringify({ ...fresh(), lo: { eq: { shield: { k: "gen2", u: "s" } }, meds: 0 } }));
    expect(worn.lo.eq.shield?.k).toBe("gen2");
    const old = parseSave(JSON.stringify({ ...fresh(), lo: { eq: { gun: { k: "p9", u: "w" } }, meds: 0 } }));
    expect(old.lo.eq.shield).toBeNull();
  });

  it("moves a blade from the gun slot to its own slot", () => {
    const s = parseSave(JSON.stringify({ ...fresh(), lo: { w: { k: "bat", u: "w" }, a: null, meds: 0 } }));
    expect(s.lo.eq.gun).toBeNull();
    expect(s.lo.eq.blade?.k).toBe("bat");
  });

  it("moves the two-weapon loadout onto the character sheet", () => {
    const s = parseSave(
      JSON.stringify({ ...fresh(), lo: { w: { k: "p9", u: "w" }, m: { k: "bat", u: "m" }, a: { k: "vest1", u: "a" }, meds: 1, keys: 0 } }),
    );
    expect([s.lo.eq.gun?.k, s.lo.eq.blade?.k, s.lo.eq.body?.k, s.lo.eq.head]).toEqual(["p9", "bat", "vest1", null]);
    expect(s.lo.meds).toBe(1);
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
    const done = applyRaid({ kills: 3, violet: 1, vaults: 0, boss: 0, haul: 650 });
    expect(done.map((q) => q.u)).toEqual(["k", "h"]);
    expect(qInfo(S.q[1])).toMatchObject({ h: 1, done: false });
  });
});

describe("resetSave", () => {
  it("brings back a new player's save, whatever was earned", () => {
    setSave({ ...fresh(), credits: 9000, stash: [{ k: "gen4", u: "s" }], up: { bag: 2, meds: 1, hp: 3 }, zx: [3, 3, 1, 0, 0] });
    S.lo.eq.gun = { k: "ar", u: "g" };
    resetSave();
    expect(S).toEqual(fresh());
  });
});

describe("parseSave raid log", () => {
  it("gives a save from before the raid log an empty one, and keeps only the last raids", () => {
    const { log, ...old } = fresh();
    expect(parseSave(JSON.stringify(old)).log).toEqual(log);
    const many = Array.from({ length: LOG_MAX + 5 }, (_, n) => ({ n }));
    expect(parseSave(JSON.stringify({ ...fresh(), log: many })).log.map((l) => l.n)).toEqual(many.slice(5).map((l) => l.n));
  });
});
