import { valOf } from "../src/items";
import { norm } from "../src/progression";
import { S, fresh, setSave } from "../src/state";
import { ZONES, power } from "../src/zones";
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
  sold: number;
  quests: number;
  spent: number;
  idle: boolean;
}

export interface Career {
  steps: Step[];
  /** raid number at which each milestone was first met, or null */
  marks: Record<string, number | null>;
}

export const MARKS = [...ZONES.slice(1).map((z) => `Joue ${z.name}`), "Planque au maximum", "Tout au maximum", "Première mort"] as const;

const stashValue = () => S.stash.reduce((s, it) => s + valOf(it), 0);

function markAll(marks: Career["marks"], i: number, st: Step) {
  const met = (m: string, yes: boolean) => {
    if (yes && marks[m] === null) marks[m] = i + 1;
  };
  for (const [j, z] of ZONES.slice(1).entries()) met(`Joue ${z.name}`, st.zone >= j + 1);
  met(
    "Planque au maximum",
    Object.values(S.up).every((l) => l >= 3),
  );
  met("Tout au maximum", st.idle);
  met("Première mort", !st.ok);
}

export function career(p: Profile, raids: number, maps: CrateSpot[][]): Career {
  setSave(fresh());
  norm();
  const steps: Step[] = [];
  const marks: Career["marks"] = Object.fromEntries(MARKS.map((m) => [m, null]));
  for (let i = 0; i < raids; i++) {
    const before = gearValue();
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
      ...flow,
    };
    steps.push(st);
    markAll(marks, i, st);
  }
  return { steps, marks };
}
