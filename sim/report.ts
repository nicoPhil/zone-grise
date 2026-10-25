import { ZONES } from "../src/zones";
import { MARKS, type Career, type Step } from "./career";
import type { Profile } from "./raid";

export interface Run {
  profile: Profile;
  careers: Career[];
}

const q = (xs: number[], f: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

type Field = "credits" | "worth" | "power" | "zone" | "ups" | "build" | "haul";
const FIELDS: Field[] = ["credits", "worth", "power", "zone", "ups", "build", "haul"];

/** p25, median and p75 of a field at each raid number. */
function bands(cs: Career[], f: Field, raids: number) {
  return Array.from({ length: raids }, (_, i) => {
    const xs = cs.map((c) => c.steps[i][f]);
    return [q(xs, 0.25), q(xs, 0.5), q(xs, 0.75)];
  });
}

function marks(cs: Career[]) {
  return MARKS.map((m) => {
    const hit = cs.map((c) => c.marks[m]).filter((x): x is number => x !== null);
    return { m, share: hit.length / cs.length, median: hit.length ? q(hit, 0.5) : null };
  });
}

/** Per zone: raids played there, share survived, mean haul when out alive and mean value lost at death. */
function perZone(cs: Career[]) {
  const all = cs.flatMap((c) => c.steps);
  return ZONES.map((z, i) => {
    const s = all.filter((x) => x.zone === i);
    return {
      zone: z.name,
      raids: s.length / cs.length,
      ext: avg(s.map((x) => (x.ok ? 1 : 0))),
      haul: avg(s.filter((x) => x.ok).map((x) => x.haul)),
      lost: avg(s.filter((x) => !x.ok).map((x) => x.lost)),
    };
  });
}

function flows(cs: Career[], raids: number) {
  const out = [];
  for (let a = 0; a < raids; a += 25) {
    const s = cs.flatMap((c) => c.steps.slice(a, a + 25));
    out.push({ from: a + 1, sold: avg(s.map((x) => x.sold)), quests: avg(s.map((x) => x.quests)), spent: avg(s.map((x) => x.spent)) });
  }
  return out;
}

/** Raids after a death until power is back to 80 % of what it was just before. */
function recovery(steps: Step[]): number[] {
  const out: number[] = [];
  for (const [i, s] of steps.entries()) {
    if (s.ok || i === 0 || i > steps.length - 15) continue;
    const pre = steps[i - 1].power,
      back = steps.findIndex((t, j) => j > i && t.power >= 0.8 * pre);
    out.push(back < 0 ? 15 : back - i);
  }
  return out;
}

export function summary({ profile, careers: cs }: Run, raids: number) {
  const late = cs.flatMap((c) => c.steps.slice(50));
  const all = cs.flatMap((c) => c.steps);
  return {
    profile,
    bands: Object.fromEntries(FIELDS.map((f) => [f, bands(cs, f, raids)])),
    marks: marks(cs),
    zones: perZone(cs),
    flows: flows(cs, raids),
    /** credits spent over credits earned, from raid 51 on */
    spendRatio: sum(late.map((s) => s.spent)) / Math.max(1, sum(late.map((s) => s.sold + s.quests))),
    questShare: sum(all.map((s) => s.quests)) / Math.max(1, sum(all.map((s) => s.sold + s.quests))),
    recovery: q(
      cs.flatMap((c) => recovery(c.steps)),
      0.5,
    ),
    broke: avg(all.map((s) => (s.broke ? 1 : 0))),
    /** mean credits per raid from raid 51 on: basic kit, upgrades and bench, stations, crafts, merchant pieces, medkits */
    spentBy: [0, 1, 2, 3, 4, 5].map((k) => avg(late.map((s) => s.by[k]))),
    /** mean station levels after the last raid: bench, pocket, trade */
    stations: [0, 1, 2].map((k) => avg(cs.map((c) => c.steps[raids - 1].sta[k]))),
  };
}
export type Summary = ReturnType<typeof summary>;

const mark = (s: Summary, m: string) => {
  const k = s.marks.find((x) => x.m === m);
  return k?.median ? `${k.median} (${Math.round(k.share * 100)}%)` : "never";
};

/** One line per profile with the numbers the targets are about. */
export function score(res: Summary[]): string {
  return res
    .map((s) => {
      const cr = (i: number) => Math.round(s.bands.credits[i - 1]?.[1] / 1000);
      return [
        s.profile.name.padEnd(10),
        `Épicentre ${mark(s, "Joue Épicentre")}`,
        `planque ${mark(s, "Planque complète")}`,
        `atelier ${mark(s, "Atelier d'origine au max")}`,
        `cr@50/100/150 ${cr(50)}k/${cr(100)}k/${cr(150)}k`,
        `dépense ${Math.round(s.spendRatio * 100)}%`,
        `contrats ${Math.round(s.questShare * 100)}%`,
        `retour ${s.recovery} raids`,
        `fauché ${(s.broke * 100).toFixed(1)}%`,
        `income/raid@26-50 ${Math.round(s.flows[1].sold + s.flows[1].quests)}`,
        `stations b/p/t ${s.stations.map((x) => x.toFixed(1)).join("/")}`,
        `spent kit/up/sta/craft/shop/med ${s.spentBy.map((x) => Math.round(x)).join("/")}`,
      ].join(" · ");
    })
    .join("\n");
}
