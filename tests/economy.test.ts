import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECIPES,
  STATIONS,
  STOCK,
  benchBlock,
  benchCost,
  build,
  craft,
  freeKit,
  improve,
  needs,
  pocketed,
  recycled,
  restock,
  saleOf,
} from "../src/economy";
import { def, mk } from "../src/items";
import { newQuest } from "../src/progression";
import { S, fresh, setSave } from "../src/state";

beforeEach(() => setSave(fresh()));
afterEach(() => vi.restoreAllMocks());

describe("merchant", () => {
  it("buys back rare finds at a better share of their value, components at 60 %", () => {
    expect(saleOf(mk("cans"))).toBe(Math.round(12 * 0.3));
    expect(saleOf(mk("dmr"))).toBe(Math.round(1400 * 0.6));
    expect(saleOf(mk("flesh"))).toBe(Math.round(15 * 0.6));
  });

  it("draws new pieces once per raid played, no rarer than the trade post allows", () => {
    restock();
    const first = S.stock.k;
    expect(first).toHaveLength(STOCK);
    expect(first.every((k) => def(k).r === 0)).toBe(true);
    restock();
    expect(S.stock.k).toBe(first);
    S.sta.trade = 2;
    for (let i = 0; i < 30; i++) {
      S.st.raids++;
      restock();
      expect(S.stock.k.every((k) => def(k).r <= 2)).toBe(true);
    }
  });

  it("lends a pistol only to a player with no gun anywhere and too little to buy one", () => {
    expect(freeKit()).toBe(false);
    S.credits = 0;
    S.stash.push(mk("revolver"));
    expect(freeKit()).toBe(false);
    S.stash = [];
    expect(freeKit()).toBe(true);
    expect(S.lo.eq.gun?.k).toBe("p9");
  });
});

describe("recycling", () => {
  it("breaks weapons, worn gear, shields and electronics into common materials", () => {
    const kinds = (k: Parameters<typeof recycled>[0]) => recycled(k).map((i) => i.k);
    expect(kinds("ar")).toEqual(["scrap", "scrap", "scrap", "bolts", "bolts", "bolts"]);
    expect(kinds("gen1")).toEqual(["batt", "wires"]);
    expect(kinds("laptop")).toEqual(["wires", "wires", "wires", "batt"]);
    expect(kinds("gold")).toEqual([]);
  });
});

describe("hideout stations", () => {
  it("build level by level when paid in credits and items", () => {
    S.credits = 100000;
    expect(build("bench")).toBe(false);
    S.stash.push(
      ...["scrap", "scrap", "scrap", "scrap", "scrap", "scrap", "bolts", "bolts", "bolts", "bolts"].map((k) => mk(k as "scrap")),
    );
    S.stash.push(mk("gunparts"), mk("gunparts"), mk("gunparts"));
    expect(build("bench")).toBe(true);
    expect(S.sta.bench).toBe(1);
    expect(S.credits).toBe(100000 - STATIONS.bench.cost[0].cr);
    expect(S.stash).toEqual([]);
  });

  it("cap bench levels on a piece at the bench station's level, rarer pieces costing more", () => {
    const gun = mk("dmr");
    expect(benchBlock(gun)).toBe("Établi niv. 1");
    expect(improve(gun)).toBe(false);
    S.sta.bench = 1;
    expect(benchBlock(gun)).toBeNull();
    expect(benchCost(gun).cr).toBe(Math.round(250 * 2.5));
    expect(benchCost(mk("p9")).cr).toBe(250);
    expect(benchBlock({ ...gun, lv: 3 })).toBe("Max");
  });

  it("let recipes be made only from the bench level they need", () => {
    const rc = RECIPES[0];
    S.credits = 10000;
    for (const [k, n] of Object.entries(rc.cost.it)) for (let i = 0; i < (n || 0); i++) S.stash.push(mk(k as "batt"));
    expect(craft(rc)).toBe(false);
    S.sta.bench = rc.bench;
    expect(craft(rc)).toBe(true);
    expect(S.stash.map((i) => i.k)).toEqual([rc.out]);
  });

  it("flag the items the next station level asks for", () => {
    expect(needs().get("gunparts")).toBe("atelier");
  });
});

describe("secure pocket", () => {
  it("keeps the most valuable items that fit its places", () => {
    const bag = [mk("cans"), mk("gold"), mk("laptop"), mk("jewels")];
    expect(pocketed(bag)).toEqual([]);
    S.sta.pocket = 2;
    expect(pocketed(bag).map((i) => i.k)).toEqual(["jewels", "gold"]);
  });
});

describe("contracts", () => {
  it("pay more in deeper zones", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    const near = newQuest().cr;
    S.zone = 4;
    expect(newQuest().cr).toBe(Math.round((near * 1.6) / 10) * 10);
  });
});
