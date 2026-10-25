import { mkdirSync, writeFileSync } from "node:fs";
import { career } from "./career";
import { useEcon } from "./econ";
import { sampleMap } from "./map";
import { PROFILES, type Profile } from "./raid";
import { score, summary, type Run } from "./report";
import { VARIANTS } from "./variants";

// npx vite-node sim/run.ts [variant] [careers] [raids] [scale]: writes sim/out/<variant>-<scale>.json and prints a scorecard;
// scale multiplies the crates opened and enemies killed by every profile
const VARIANT = process.argv[2] || "game",
  CAREERS = Number(process.argv[3]) || 300,
  RAIDS = Number(process.argv[4]) || 150,
  SCALE = Number(process.argv[5]) || 1,
  MAPS = 40;

const scaled = (p: Profile): Profile => {
  const by = (ns: number[]) => ns.map((n) => Math.round(n * SCALE)) as Profile["crates"];
  return { ...p, crates: by(p.crates), kills: by(p.kills) };
};

function main() {
  const econ = VARIANTS[VARIANT];
  if (!econ) throw new Error(`unknown variant ${VARIANT}: ${Object.keys(VARIANTS).join(", ")}`);
  useEcon(econ);
  const maps = Array.from({ length: MAPS }, sampleMap);
  const runs: Run[] = PROFILES.map(scaled).map((p) => ({
    profile: p,
    careers: Array.from({ length: CAREERS }, () => career(p, RAIDS, maps)),
  }));
  const res = runs.map((r) => summary(r, RAIDS));
  mkdirSync("sim/out", { recursive: true });
  writeFileSync(`sim/out/${VARIANT}-${SCALE}.json`, JSON.stringify({ variant: econ, careers: CAREERS, raids: RAIDS, scale: SCALE, res }));
  console.log(score(res));
}

main();
