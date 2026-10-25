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

import { mk } from "../src/items";
import { CALL_TIME, DEATH_TIME, R, type Raid, startRaid, update } from "../src/raid";
import { hitEnemy } from "../src/raid/combat";
import { spawn } from "../src/raid/enemies";
import { S, fresh, mode, setMode, setSave } from "../src/state";
import { H, W } from "../src/world/mapgen";

const DT = 1 / 60;
const run = (s: number) => {
  for (let t = 0; t < s && mode !== "end"; t += DT) update(DT);
};

function quietRaid(): Raid {
  startRaid();
  if (!R) throw new Error("startRaid left no raid");
  R.enemies = [];
  R.spawnT = Infinity;
  return R;
}

beforeEach(() => {
  vi.clearAllMocks();
  setSave(fresh());
  setMode("stash");
});

describe("raid log", () => {
  it("notes each raid in the save's log, extracted or lost", () => {
    const r = quietRaid();
    r.tally.kills = 3;
    r.t = DT / 2;
    run(DEATH_TIME + 0.2);
    const r2 = quietRaid();
    r2.bag.push(mk("gold"));
    r2.ebul.push({ x: r2.p.x, y: r2.p.y, vx: 0, vy: 0, life: 1, dmg: 30 });
    update(DT);
    Object.assign(r2.p, r2.exits[0]);
    update(DT);
    r2.enemies = [];
    run(CALL_TIME + 1);
    const [a, b] = S.log.map((l) => [l.n, l.ok, l.kills, l.val > 0, l.dmg, l.hp]);
    expect([a, b, S.log[0].t]).toEqual([[1, false, 3, false, 0, 100], [2, true, 0, true, 30, 70], 180]);
  });

  it("notes the time spent in the Cœur and the average time from first hit to kill", () => {
    const r = quietRaid();
    r.walls = [];
    Object.assign(r.p, { x: W / 2, y: H / 2 });
    spawn(r, "walker", { x: W / 2 + 300, y: H / 2 });
    const e = r.enemies[0];
    hitEnemy(r, e, { dmg: 1, at: e });
    run(2);
    hitEnemy(r, e, { dmg: 9999, at: e });
    r.t = DT / 2;
    run(DEATH_TIME + 0.2);
    expect(S.log[0].core).toBeGreaterThanOrEqual(2);
    expect(S.log[0].ttk).toBeCloseTo(2, 1);
  });
});
