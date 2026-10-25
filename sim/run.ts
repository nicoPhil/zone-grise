import { mkdirSync, writeFileSync } from "node:fs";
import { ZONES } from "../src/zones";
import { MARKS, career, type Career, type Step } from "./career";
import { sampleMap } from "./map";
import { PROFILES, type Profile } from "./raid";

// npx vite-node sim/run.ts [careers] [raids] [scale]: writes sim/out/econ-<scale>.json and prints a summary;
// scale multiplies the crates opened and enemies killed by every profile
const CAREERS = Number(process.argv[2]) || 300,
  RAIDS = Number(process.argv[3]) || 150,
  SCALE = Number(process.argv[4]) || 1,
  MAPS = 40;
const scaled = (p: Profile): Profile => {
  const by = (ns: number[]) => ns.map((n) => Math.round(n * SCALE)) as Profile["crates"];
  return { ...p, crates: by(p.crates), kills: by(p.kills) };
};

const q = (xs: number[], f: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(f * s.length))];
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

type Field = Exclude<keyof Step, "ok" | "idle">;
const FIELDS: Field[] = ["credits", "worth", "power", "zone", "ups", "haul"];

/** p25, median and p75 of a field at each raid number. */
function bands(cs: Career[], f: Field) {
  return Array.from({ length: RAIDS }, (_, i) => {
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

/** Where the credits came from and went, per raid, over windows of 25 raids. */
function flows(cs: Career[]) {
  const out = [];
  for (let a = 0; a < RAIDS; a += 25) {
    const s = cs.flatMap((c) => c.steps.slice(a, a + 25));
    out.push({
      from: a + 1,
      sold: avg(s.map((x) => x.sold)),
      quests: avg(s.map((x) => x.quests)),
      spent: avg(s.map((x) => x.spent)),
      idle: avg(s.map((x) => (x.idle ? 1 : 0))),
    });
  }
  return out;
}

function main() {
  const t0 = Date.now();
  const maps = Array.from({ length: MAPS }, sampleMap);
  const res = PROFILES.map(scaled).map((p) => {
    const cs = Array.from({ length: CAREERS }, () => career(p, RAIDS, maps));
    return {
      profile: p,
      bands: Object.fromEntries(FIELDS.map((f) => [f, bands(cs, f)])),
      marks: marks(cs),
      zones: perZone(cs),
      flows: flows(cs),
    };
  });
  mkdirSync("sim/out", { recursive: true });
  writeFileSync(`sim/out/econ-${SCALE}.json`, JSON.stringify({ careers: CAREERS, raids: RAIDS, scale: SCALE, res }));
  console.log(
    JSON.stringify(
      res.map(({ profile, marks: m, zones, flows: f }) => ({ p: profile.name, m, zones, f })),
      null,
      1,
    ),
  );
  console.log(`${CAREERS} careers × ${RAIDS} raids × ${PROFILES.length} profiles in ${Date.now() - t0} ms`);
}

main();
