import { beforeEach, describe, expect, it } from "vitest";
import { mount, strip, unmount } from "../src/armory";
import { ATT_ITEMS } from "../src/attach";
import { restock } from "../src/economy";
import { def, mk, valOf, wstat } from "../src/items";
import { roll } from "../src/rolls";
import { S, fresh, parseSave, setSave } from "../src/state";
import { rollItem } from "../src/world/mapgen";

beforeEach(() => setSave(fresh()));

describe("gun attachments", () => {
  it("scale their gain with rarity and keep the same drawback", () => {
    expect([ATT_ITEMS.heavy0.fx, ATT_ITEMS.heavy2.fx, ATT_ITEMS.heavy3.fx]).toEqual([
      { noise: 0.25, dmg: 0.12 },
      { noise: 0.25, dmg: 0.2 },
      { noise: 0.25, dmg: 0.26 },
    ]);
  });

  it("change the gun's stats, changes on one stat adding up", () => {
    const gun = { ...mk("ar"), att: { barrel: mk("heavy2"), mech: mk("bolt2"), sight: mk("scope2") } };
    // dmg 17 × (1 + 0.2 + 0.25), rate 5 × (1 − 0.15 − 0.15)
    expect(wstat(gun)).toMatchObject({ dmg: 25, rate: 3.5, range: 504, spr: 0.035, noise: 363 });
  });

  it("scale only their gain with their rolled quality", () => {
    const gun = { ...mk("ar"), att: { barrel: { ...mk("heavy2"), q: 1.1 } } };
    expect(wstat(gun)).toMatchObject({ dmg: 21, noise: 363 });
  });

  it("roll a quality and nothing else", () => {
    const a = roll(mk("spring1"));
    expect(a.q).toBeGreaterThanOrEqual(0.9);
    expect(a.fx).toBeUndefined();
  });

  it("mount on the worn gun, sending the one replaced back to the stash", () => {
    const [a, b] = [mk("heavy1"), mk("silencer1")];
    S.stash.push(a, b);
    expect(mount(a.u)).toBe(false);
    S.lo.eq.gun = mk("p9");
    expect(mount(a.u) && mount(b.u)).toBe(true);
    expect([S.lo.eq.gun.att?.barrel, S.stash]).toEqual([b, [a]]);
    expect(unmount("barrel")).toBe(true);
    expect([S.lo.eq.gun.att?.barrel, S.stash]).toEqual([undefined, [a, b]]);
  });

  it("come off a gun that is sold or recycled", () => {
    const a = mk("laser3"),
      gun = { ...mk("p9"), att: { sight: a } };
    expect([strip(gun), gun.att]).toEqual([[a], undefined]);
  });

  it("drop from military crates and the Brute, and come with the merchant's stock", () => {
    expect(def(rollItem(1, { minR: 2, att: 1 }).k).t).toBe("att");
    S.sta.trade = 3;
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      S.st.raids++;
      restock();
      for (const it of S.stock.items) seen.add(def(it.k).t);
    }
    expect(seen.has("att")).toBe(true);
  });

  it("are kept on a saved gun, unknown ones dropped", () => {
    const gun = { k: "ar", u: "g", att: { barrel: { k: "heavy2", u: "a", q: 1 }, sight: { k: "gone", u: "b" } } };
    const s = parseSave(JSON.stringify({ ...fresh(), stash: [gun] }));
    expect(s.stash[0].att).toEqual({ barrel: { k: "heavy2", u: "a", q: 1 } });
    expect(valOf(s.stash[0])).toBe(valOf(mk("ar")));
  });
});
