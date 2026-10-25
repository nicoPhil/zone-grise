import { price, valOf } from "../src/items";
import { norm } from "../src/progression";
import { S, fresh, setSave } from "../src/state";
import { ZONES, power } from "../src/zones";
import { X, resetX } from "./econ";
import { endRaid, gearValue, hideout } from "./hideout";
import type { CrateSpot } from "./map";
import { simRaid, type Profile } from "./raid";

/** The state after one raid and its trip to the hideout. */
export interface Step {
  zone: number;
  ok: boolean;
  haul: number;
  lost: number;
  credits: number;
  worth: number;
  power: number;
  ups: number;
  /** hideout levels built: the game's upgrades plus the stations */
  build: number;
  sold: number;
  quests: number;
  spent: number;
  by: number[];
  done: boolean;
  /** started the raid with no gun and not enough to buy one */
  broke: boolean;
  /** bench, pocket and trade station levels */
  sta: number[];
}

export interface Career {
  steps: Step[];
  /** raid number at which each milestone was first met, or null */
  marks: Record<string, number | null>;
}

export const MARKS = [
  ...ZONES.slice(1).map((z) => `Joue ${z.name}`),
  "Atelier d'origine au max",
  "Planque complète",
  "Première mort",
] as const;

const stashValue = () => S.stash.reduce((s, it) => s + valOf(it), 0);

function markAll(marks: Career["marks"], i: number, st: Step) {
  const met = (m: string, yes: boolean) => {
    if (yes && marks[m] === null) marks[m] = i + 1;
  };
  for (const [j, z] of ZONES.slice(1).entries()) met(`Joue ${z.name}`, st.zone >= j + 1);
  met(
    "Atelier d'origine au max",
    Object.values(S.up).every((l) => l >= 3),
  );
  met("Planque complète", st.done);
  met("Première mort", !st.ok);
}

export function career(p: Profile, raids: number, maps: CrateSpot[][]): Career {
  setSave(fresh());
  resetX();
  norm();
  const steps: Step[] = [];
  const marks: Career["marks"] = Object.fromEntries(MARKS.map((m) => [m, null]));
  for (let i = 0; i < raids; i++) {
    const before = gearValue(),
      broke = !S.lo.eq.gun && S.credits < price("p9");
    const r = simRaid(p, maps[Math.floor(Math.random() * maps.length)]);
    endRaid(p, r);
    const flow = hideout();
    const st: Step = {
      zone: r.zone,
      ok: r.ok,
      haul: r.ok ? r.tally.haul : 0,
      lost: r.ok ? 0 : before + r.tally.haul,
      credits: S.credits,
      worth: S.credits + stashValue() + gearValue(),
      power: power(),
      ups: Object.values(S.up).reduce((s, l) => s + l, 0),
      broke,
      sta: [X.st.bench, X.st.pocket, X.st.trade],
      build: Object.values(S.up).reduce((s, l) => s + l, 0) + X.st.bench + X.st.pocket + X.st.trade,
      ...flow,
    };
    steps.push(st);
    markAll(marks, i, st);
  }
  return { steps, marks };
}
