import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/render/canvas", () => ({ C: { ok: "", bad: "", accent: "" } }));
vi.mock("../src/render/furniture", () => ({ furnish: () => [] }));
vi.mock("../src/render/decor", () => ({
  THEMES: Array.from({ length: 5 }, () => ({ fit: "house", mess: 0 })),
  blood: () => {},
  makeDecal: () => ({}),
  makeDecor: () => [],
  makeGround: () => [],
  stampCasing: () => {},
}));
vi.mock("../src/input", () => ({ moveVec: vi.fn(() => ({ x: 0, y: 0 })), clearStick: () => {}, prefs: { fire: true } }));
vi.mock("../src/ui/hud", () => ({ setRaidHud: () => {}, showHint: () => {}, toast: vi.fn(), updHud: () => {} }));
vi.mock("../src/ui/bag", () => ({ closeBag: () => {} }));
vi.mock("../src/ui/end", () => ({ renderEnd: vi.fn() }));

import { moveVec } from "../src/input";
import { mk } from "../src/items";
import { DEATH_TIME, EXTRACT_TIME, KINDS, R, type Raid, heal, startRaid, update } from "../src/raid";
import { S, fresh, mode, setMode, setSave } from "../src/state";
import { toast } from "../src/ui/hud";
import { renderEnd } from "../src/ui/end";
import { UNLOCK_AFTER, ZONES } from "../src/zones";

const DT = 1 / 60;
const run = (s: number) => {
  for (let t = 0; t < s && mode !== "end"; t += DT) update(DT);
};
const ended = () => vi.mocked(renderEnd).mock.calls.at(-1)?.[0];

/** A raid with no enemy and no wave, so only what a test sets up happens. */
function quietRaid(): Raid {
  startRaid();
  const r = R!;
  r.enemies = [];
  r.spawnT = Infinity;
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  setSave(fresh());
  setMode("stash");
});

describe("raid", () => {
  it("extracts after standing still on an exit: the bag goes to the stash and the extraction counts for the zone", () => {
    const r = quietRaid();
    const loot = mk("med");
    r.bag.push(loot);
    Object.assign(r.p, r.exits[0]);
    run(EXTRACT_TIME + 0.5);
    expect(ended()).toMatchObject({ ok: true, items: [loot] });
    expect(S.stash).toContainEqual(loot);
    expect([S.st.ext, S.zx[0]]).toEqual([1, 1]);
  });

  it("restarts the extraction countdown when the player moves inside the exit", () => {
    const r = quietRaid();
    Object.assign(r.p, r.exits[0]);
    run(EXTRACT_TIME - 0.5);
    vi.mocked(moveVec).mockReturnValueOnce({ x: 0.01, y: 0 });
    update(DT);
    run(EXTRACT_TIME - 0.5);
    expect(mode).toBe("raid");
  });

  it("loses everything worn and carried on death, after the death sequence", () => {
    const gun = mk("p9");
    S.lo.eq.gun = gun;
    S.lo.meds = 2;
    const r = quietRaid();
    const loot = mk("med");
    r.bag.push(loot);
    r.ebul.push({ x: r.p.x, y: r.p.y, vx: 0, vy: 0, life: 1, dmg: 9999 });
    update(DT);
    expect(mode).toBe("raid");
    run(DEATH_TIME + 0.1);
    expect(ended()).toMatchObject({ ok: false, meds: 2, items: [gun, loot] });
    expect(S.lo).toMatchObject({ meds: 0, keys: 0, eq: { gun: null } });
    expect(S.st.dead).toBe(1);
    expect(S.stash).toEqual([]);
  });

  it("is lost when the clock runs out", () => {
    const r = quietRaid();
    r.t = DT / 2;
    run(DEATH_TIME + 0.2);
    expect(ended()).toMatchObject({ ok: false, why: "Temps écoulé : la zone a été verrouillée." });
  });

  it("takes melee damage scaled by the zone from an enemy in contact", () => {
    S.zx[0] = UNLOCK_AFTER;
    S.zone = 1;
    startRaid();
    const r = R!;
    const e = r.enemies[0];
    Object.assign(r, { enemies: [e], spawnT: Infinity });
    Object.assign(e, { kind: "walker", x: r.p.x, y: r.p.y, aggro: true, cd: 0 });
    r.p.mcd = Infinity;
    const hp0 = r.p.hp;
    update(DT);
    expect(hp0 - r.p.hp).toBeCloseTo(KINDS.walker.melee * ZONES[1].dmg * (1 - r.p.st.red));
  });

  it("heals over time with a carried medkit, and keeps it when HP is full", () => {
    const r = quietRaid();
    r.p.meds = 1;
    heal();
    expect(r.p.meds).toBe(1);
    expect(toast).toHaveBeenCalledWith("PV déjà au maximum");
    r.p.hp = 10;
    heal();
    expect(r.p.meds).toBe(0);
    run(30);
    expect(r.p.hp).toBeGreaterThan(10);
    expect(r.p.hp).toBeLessThanOrEqual(r.p.max);
  });
});
