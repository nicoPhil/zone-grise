import { mk, slotOf, type ItemKey } from "../../src/items";
import { R, RAID_TIME, startRaid, update, type Kind, type Raid } from "../../src/raid";
import { S, fresh, mode, setSave } from "../../src/state";
import { Bot, type Notes } from "./bot";
import type { Style } from "./goals";
import { end } from "./stubs/end";
import { toasts } from "./stubs/hud";

/** Gear worn into each zone: roughly what a player who has just opened it would own. */
const KITS: { eq: ItemKey[]; meds: number }[] = [
  { eq: ["p9"], meds: 1 },
  { eq: ["smg", "vest1", "beanie", "gen2", "satchel"], meds: 2 },
  { eq: ["ar", "vest1", "hardhat", "gen2", "daypack", "sneakers"], meds: 3 },
  { eq: ["ar", "vest2", "helmet", "gen3", "daypack", "boots", "tacgloves"], meds: 3 },
  { eq: ["lmg", "armor", "helmet", "gen4", "milpack", "trail", "sniperglv"], meds: 4 },
];

export interface RaidRecord {
  zone: number;
  style: string;
  power: number;
  ok: boolean;
  why: string;
  /** raid seconds played */
  t: number;
  val: number;
  deep: number;
  kills: number;
  boss: number;
  vaults: number;
  /** crates opened by tier: debris, crate, military */
  crates: [number, number, number];
  dmg: number;
  /** the extraction had been called when the raid ended */
  called: boolean;
  /** ms of real time per simulated second */
  cost: number;
  bot: Notes;
  /** enemies on to the player within 400 px when it died, and the ring it died in (-1 alive) */
  killers: Kind[];
  ring: number;
  last: string[];
}

function gearUp(zi: number) {
  setSave(fresh());
  S.opened = 4;
  S.zone = zi;
  for (const k of KITS[zi].eq) {
    const it = mk(k),
      slot = slotOf(it);
    if (slot) S.lo.eq[slot] = it;
  }
  S.lo.meds = KITS[zi].meds;
}

const DT = 1 / 60;

const aroundAtDeath = (r: Raid) => r.enemies.filter((e) => e.aggro && Math.hypot(e.x - r.p.x, e.y - r.p.y) < 400).map((e) => e.kind);

export function playRaid(zi: number, style: Style): RaidRecord {
  gearUp(zi);
  end.res = null;
  toasts.length = 0;
  startRaid();
  const r = R;
  if (!r) throw new Error("no raid");
  const bot = new Bot(style),
    t0 = performance.now();
  let n = 0,
    killers: Kind[] = [],
    ring = -1;
  while (mode !== "end" && n < (RAID_TIME + 10) / DT) {
    bot.play(r, DT);
    update(DT);
    n++;
    if (r.dead > 0 && ring < 0) [killers, ring] = [aroundAtDeath(r), r.ring];
  }
  const res = end.res as { ok: boolean; why: string; val: number } | null;
  const count = (tier: number) => r.crates.filter((c) => c.open && !c.vault && c.tier === tier).length;
  return {
    zone: zi,
    style: style.name,
    power: r.power0,
    ok: !!res?.ok,
    why: res?.why ?? "pas fini",
    t: Math.round(RAID_TIME - Math.max(0, r.t)),
    val: res?.val ?? 0,
    deep: r.deep,
    ...r.tally,
    crates: [count(0), count(1), count(2)],
    dmg: Math.round(r.dmg),
    called: !!r.call,
    cost: (performance.now() - t0) / (n * DT),
    bot: bot.notes,
    killers,
    ring,
    last: toasts.slice(-6),
  };
}
