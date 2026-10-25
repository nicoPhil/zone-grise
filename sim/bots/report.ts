import { readFileSync } from "node:fs";
import { ZONES } from "../../src/zones";
import { STYLES } from "./goals";
import type { RaidRecord } from "./play";

// npx vite-node -c sim/bots/vite.config.ts sim/bots/report.ts sim/out/bots.jsonl: one table per zone, one row per bot style
const rows: RaidRecord[] = readFileSync(process.argv[2] || "sim/out/bots.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pct = (xs: RaidRecord[], f: (x: RaidRecord) => boolean) => `${Math.round((100 * xs.filter(f).length) / (xs.length || 1))}%`;
const r0 = (x: number) => String(Math.round(x));
const r1 = (x: number) => x.toFixed(1);

function line(rs: RaidRecord[]) {
  const ok = rs.filter((x) => x.ok),
    dead = rs.filter((x) => !x.ok);
  const leaves = ["sac", "PV", "temps", "plus rien"].map((w) => `${w[0]}${pct(rs, (x) => x.bot.leave === w).replace("%", "")}`).join(" ");
  return [
    rs.length,
    pct(rs, (x) => x.ok),
    r0(avg(rs.map((x) => (x.ok ? x.val : 0)))),
    r0(avg(ok.map((x) => x.val))),
    r0(avg(dead.map((x) => x.val))),
    pct(rs, (x) => !x.ok && x.why.startsWith("Temps")),
    pct(rs, (x) => !x.ok && x.called),
    r0(avg(rs.map((x) => x.t))),
    leaves,
    pct(rs, (x) => x.deep === 2),
    rs.length ? [0, 1, 2].map((t) => r1(avg(rs.map((x) => x.crates[t])))).join("/") : "",
    r1(avg(rs.map((x) => x.kills))),
    r0(avg(rs.map((x) => x.dmg))),
    r1(avg(rs.map((x) => x.bot.stuck.length + x.bot.gaveUp))),
    r0(avg(rs.map((x) => x.cost))),
  ];
}

const HEAD = [
  "bot",
  "n",
  "sortis",
  "gain/raid",
  "butin sorti",
  "perte mort",
  "mort chrono",
  "mort en appel",
  "durée",
  "départ s/P/t/p %",
  "Cœur",
  "caisses d/c/m",
  "kills",
  "PV perdus",
  "bloqué",
  "ms/s",
];

function table(cells: string[][]) {
  const w = HEAD.map((_, i) => Math.max(...cells.map((c) => String(c[i]).length)));
  return cells.map((c) => c.map((v, i) => String(v).padEnd(w[i])).join("  ")).join("\n");
}

for (const [zi, z] of ZONES.entries()) {
  const zr = rows.filter((x) => x.zone === zi);
  if (!zr.length) continue;
  console.log(`\n${z.name} (puissance du kit ${zr[0].power}, zone ${z.power})`);
  const body = STYLES.map((s) => [s.name, ...line(zr.filter((x) => x.style === s.name)).map(String)]);
  console.log(table([HEAD, ...body]));
}
