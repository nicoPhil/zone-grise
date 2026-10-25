import { bagUsed, def, gearStats, mk, valOf, type Item } from "../src/items";
import { cap, type RaidTally } from "../src/progression";
import { S } from "../src/state";
import { ZONES, power, zoneDepth, type Zone } from "../src/zones";
import { unlockedZone } from "./econ";
import { needed } from "./hideout";
import { crateKey, crateLoot, killDrops, killKind, tierOf, type Crate } from "./loot";
import type { CrateSpot } from "./map";

/** How a player plays a raid: the guesses the whole simulation rests on. */
export interface Profile {
  name: string;
  /** crates opened per raid in each ring: Périphérie, Zone chaude, Cœur */
  crates: [number, number, number];
  kills: [number, number, number];
  /** chance to get out alive when the player's power matches the zone's */
  ext: number;
  /** goes to the hardest open zone whose power is at most the player's over this */
  amb: number;
  /** medkits used per raid that ends alive */
  meds: number;
  /** opens the vault when holding a key, fighting the Brute for it where she guards it */
  vault: boolean;
}

export const PROFILES: Profile[] = [
  { name: "Prudent", crates: [9, 4, 0], kills: [3, 2, 0], ext: 0.92, amb: 1.3, meds: 0.5, vault: false },
  { name: "Équilibré", crates: [5, 6, 3], kills: [3, 5, 3], ext: 0.8, amb: 1, meds: 1, vault: true },
  { name: "Téméraire", crates: [3, 4, 8], kills: [2, 5, 8], ext: 0.6, amb: 0.75, meds: 2, vault: true },
];

export interface RaidOut {
  zone: number;
  ok: boolean;
  bag: Item[];
  tally: RaidTally;
  keys: number;
}

export function pickZone(p: Profile): number {
  let best = 0;
  ZONES.forEach((z, i) => {
    if (unlockedZone(S.zx, i) && power() * p.amb >= z.power) best = i;
  });
  return best;
}

/** Below the zone's power the odds drop with the square root of the gap; above it they barely rise. */
export function extChance(p: Profile, z: Zone, boss: boolean): number {
  const ratio = power() / z.power;
  const base = ratio < 1 ? p.ext * Math.sqrt(Math.max(0.1, ratio)) : p.ext + 0.05 * Math.min(1, ratio - 1);
  return Math.min(0.97, base * (boss ? 0.85 : 1));
}

function shuffled<T>(a: T[]): T[] {
  return a
    .map((x) => [Math.random(), x] as const)
    .sort((u, v) => u[0] - v[0])
    .map(([, x]) => x);
}

function openCrates(p: Profile, z: Zone, spots: CrateSpot[], tally: RaidTally): Item[] {
  const found: Item[] = [];
  p.crates.forEach((n, ring) => {
    for (const s of shuffled(spots.filter((c) => c.ring === ring)).slice(0, n)) {
      const c: Crate = { tier: tierOf(s), d: zoneDepth(z, s.d) };
      found.push(...crateLoot(c));
      if (c.tier === 2) tally.violet++;
      if (crateKey(c)) found.push(mk("vkey"));
    }
  });
  return found;
}

function fight(p: Profile, z: Zone, tally: RaidTally): Item[] {
  const found: Item[] = [];
  p.kills.forEach((n, ring) => {
    for (let i = 0; i < n; i++) found.push(...killDrops(killKind(z, ring)));
    tally.kills += n;
  });
  return found;
}

/** Opens the vault if a key is at hand; returns whether the Brute had to be fought for it. */
function raidVault(p: Profile, z: Zone, found: Item[], st: { keys: number; tally: RaidTally }): boolean {
  const bagKey = found.findIndex((i) => i.k === "vkey");
  if (!z.vault || !p.vault || (st.keys < 1 && bagKey < 0)) return false;
  if (z.boss && power() < z.power) return false;
  if (st.keys > 0) st.keys--;
  else found.splice(bagKey, 1);
  if (z.boss) {
    found.push(...killDrops("boss"));
    st.tally.boss++;
    st.tally.kills++;
  }
  for (let i = 0; i < 2; i++) found.push(...crateLoot({ tier: 2, d: 1, vault: true }));
  st.tally.vaults++;
  return z.boss;
}

/** Takes first what a contract or upgrade still lacks, then the most valuable items per bag place that fit. */
export function fillBag(found: Item[]): Item[] {
  const room = cap() + gearStats(S.lo.eq).cap,
    bag: Item[] = [];
  const lack = needed();
  for (const it of S.stash) lack.set(it.k, (lack.get(it.k) || 0) - 1);
  const wanted = (i: Item) => {
    const n = lack.get(i.k) || 0;
    lack.set(i.k, n - 1);
    return n > 0 ? 1e6 : 0;
  };
  const worth = new Map(found.map((i) => [i, wanted(i) + valOf(i) / def(i.k).s]));
  const order = [...found].sort((a, b) => (worth.get(b) || 0) - (worth.get(a) || 0));
  for (const it of order) if (bagUsed(bag) + def(it.k).s <= room) bag.push(it);
  return bag;
}

export function simRaid(p: Profile, spots: CrateSpot[]): RaidOut {
  const zone = pickZone(p),
    z = ZONES[zone];
  S.zone = zone;
  const st = { keys: S.lo.keys, tally: { kills: 0, violet: 0, vaults: 0, boss: 0, haul: 0 } };
  const found = [...openCrates(p, z, spots, st.tally), ...fight(p, z, st.tally)];
  const boss = raidVault(p, z, found, st);
  const bag = fillBag(found);
  st.tally.haul = bag.reduce((s, i) => s + valOf(i), 0);
  return { zone, ok: Math.random() < extChance(p, z, boss), bag, tally: st.tally, keys: st.keys };
}
