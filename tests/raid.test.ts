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
import { def, mk, type ItemKey } from "../src/items";
import { huntable } from "../src/progression";
import { DEATH_TIME, EXTRACT_TIME, KINDS, R, type Raid, heal, startRaid, update } from "../src/raid";
import { S, fresh, mode, setMode, setSave } from "../src/state";
import { toast } from "../src/ui/hud";
import { renderEnd } from "../src/ui/end";
import { H, W } from "../src/world/mapgen";
import { UNLOCK_AFTER, ZONES } from "../src/zones";

const DT = 1 / 60;
const run = (s: number) => {
  for (let t = 0; t < s && mode !== "end"; t += DT) update(DT);
};
const ended = () => vi.mocked(renderEnd).mock.calls.at(-1)?.[0];

/** A raid with no enemy and no wave, so only what a test sets up happens. */
function begin(): Raid {
  startRaid();
  if (!R) throw new Error("startRaid left no raid");
  return R;
}

function quietRaid(): Raid {
  const r = begin();
  r.enemies = [];
  r.spawnT = Infinity;
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  setSave(fresh());
  setMode("stash");
});

describe("raid end", () => {
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
});

describe("raid clock", () => {
  it("warns once at one minute and once at 30 s left", () => {
    const r = quietRaid();
    r.t = 61;
    run(32);
    expect(vi.mocked(toast).mock.calls.map(([m]) => m.split(" :")[0])).toEqual(["1 min", "30 s"]);
  });

  it("brings reinforcements in 700 to 1400 px from the player", () => {
    const r = quietRaid();
    r.spawnT = DT / 2;
    update(DT);
    const d = r.enemies.map((e) => Math.hypot(e.x - r.p.x, e.y - r.p.y));
    expect(d).toHaveLength(2);
    for (const x of d) expect(x).toBeGreaterThan(700);
    for (const x of d) expect(x).toBeLessThan(1400);
  });
});

describe("raid rings", () => {
  /** Puts the player, alone on a wall-free map, where the map depth is d. */
  const standAt = (r: Raid, d: number) => {
    r.walls = [];
    Object.assign(r.p, { x: W / 2 + (1 - d) * W * 0.62, y: H / 2 });
    update(DT);
  };
  const told = () => vi.mocked(toast).mock.calls.map(([m]) => m.split(" :")[0]);

  it("announces the ring the player walks into", () => {
    const r = quietRaid();
    r.ring = 0;
    standAt(r, 1);
    standAt(r, 0.1);
    expect(told()).toEqual(["Cœur", "Périphérie"]);
    expect(r.ring).toBe(0);
  });

  it("waits until the player is clearly past a ring line", () => {
    const r = quietRaid();
    r.ring = 0;
    standAt(r, 0.43);
    expect(told()).toEqual([]);
    standAt(r, 0.45);
    standAt(r, 0.41);
    expect(told()).toEqual(["Zone chaude"]);
  });
});

describe("raid shield", () => {
  const shot = (r: Raid, dmg: number) => {
    r.ebul.push({ x: r.p.x, y: r.p.y, vx: 0, vy: 0, life: 1, dmg });
    update(DT);
  };
  /** A raid in the first zone (damage ×1) wearing the 20-point shield and a vest taking 20 % off. */
  const shielded = () => {
    S.lo.eq.shield = mk("gen1");
    S.lo.eq.body = mk("vest1");
    const r = quietRaid();
    if (!r.p.sh) throw new Error("no shield worn");
    return { r, sh: r.p.sh };
  };

  it("takes a hit before HP, and armour softens only what gets through", () => {
    const { r, sh } = shielded();
    shot(r, 30);
    expect(sh.left).toBe(0);
    expect(r.p.max - r.p.hp).toBeCloseTo(8);
  });

  it("refills only once the player has gone unhit for its delay", () => {
    const { r, sh } = shielded();
    shot(r, 20);
    run(sh.delay - 0.5);
    shot(r, 0.01);
    run(sh.delay - 0.1);
    expect(sh.left).toBe(0);
    run(0.5);
    expect(sh.left).toBeGreaterThan(0);
    run(2);
    expect(sh.left).toBe(sh.pts);
  });
});

describe("raid combat", () => {
  it("takes melee damage scaled by the zone from an enemy in contact", () => {
    S.zx[0] = UNLOCK_AFTER;
    S.zone = 1;
    const r = begin();
    const e = r.enemies[0];
    Object.assign(r, { enemies: [e], spawnT: Infinity });
    Object.assign(e, { kind: "walker", x: r.p.x, y: r.p.y, aggro: true, cd: 0 });
    r.p.mcd = Infinity;
    const hp0 = r.p.hp;
    update(DT);
    expect(hp0 - r.p.hp).toBeCloseTo(KINDS.walker.melee * ZONES[1].dmg * (1 - r.p.st.red));
  });

  it.each([
    { gait: "running", push: 0.9, heard: true },
    { gait: "walking", push: 0.4, heard: false },
  ])("$gait past the back of an unaware enemy, it hears: $heard", ({ push, heard }) => {
    const r = begin();
    const w = r.enemies[0];
    Object.assign(r, { enemies: [w], spawnT: Infinity, walls: [] });
    Object.assign(w, {
      kind: "walker",
      x: r.p.x,
      y: r.p.y + 80,
      fa: Math.PI / 2,
      ta: Math.PI / 2,
      wt: Infinity,
      aggro: false,
      sus: 0,
      sr: 0,
    });
    vi.mocked(moveVec).mockReturnValue({ x: push, y: 0 });
    run(0.3);
    vi.mocked(moveVec).mockReturnValue({ x: 0, y: 0 });
    expect(w.sr > 0).toBe(heard);
  });
});

describe("raid loot", () => {
  it.each([
    { tier: 0, secs: 0.4 },
    { tier: 2, secs: 2.5 },
  ] as const)("a tier $tier crate opens after $secs s standing on it", ({ tier, secs }) => {
    const r = quietRaid();
    const c = { x: r.p.x, y: r.p.y, d: 0.3, tier, open: false, prog: 0 };
    r.crates = [c];
    run(secs - 0.1);
    expect(c.open).toBe(false);
    run(0.2);
    expect(c.open).toBe(true);
  });

  it("a military crate holds two or three rare-or-better pieces, never components", () => {
    const r = quietRaid();
    r.crates = [{ x: r.p.x, y: r.p.y, d: 0.3, tier: 2, open: false, prog: 0 }];
    run(2.6);
    const loot = [...r.bag, ...r.pick.map((q) => q.it)].map((it) => it.k).filter((k) => k !== "vkey");
    expect(loot.length).toBeGreaterThanOrEqual(2);
    expect(loot.length).toBeLessThanOrEqual(3);
    for (const k of loot) expect(def(k).r >= 1 && def(k).t !== "part", k).toBe(true);
  });

  it("a killed walker drops only its component, about half the time", () => {
    const r = begin();
    const w = r.enemies[0];
    r.spawnT = Infinity;
    r.enemies = Array.from({ length: 60 }, (_, i) => ({
      ...w,
      kind: "walker" as const,
      x: 100 + (i % 10) * 60,
      y: 100 + Math.floor(i / 10) * 60,
      hp: 1,
    }));
    r.bullets = r.enemies.map((e) => ({ x: e.x, y: e.y, vx: 0, vy: 0, life: 1, dmg: 99 }));
    update(DT);
    const drops = r.pick.map((q) => q.it.k);
    expect(new Set(drops)).toEqual(new Set<ItemKey>(["flesh"]));
    expect(drops.length).toBeGreaterThan(15);
    expect(drops.length).toBeLessThan(45);
  });
});

describe("medkits", () => {
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

describe("hunt contracts", () => {
  it("only ask for components of enemies met in the zones already open", () => {
    expect(huntable().sort()).toEqual(["flesh", "gland", "gunparts"]);
    S.zx[0] = UNLOCK_AFTER;
    expect(huntable()).toContain("gas");
  });
});
