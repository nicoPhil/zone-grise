import { mk, partOf, type Item } from "../src/items";
import type { Kind } from "../src/raid";
import { pick } from "../src/util";
import { MILITARY_SHIELDS, ROOM_SHIELDS, rollItem } from "../src/world/mapgen";
import { CORE } from "../src/world/rings";
import type { Zone } from "../src/zones";
import type { CrateSpot } from "./map";

// crate and kill loot copied from src/raid/loot.ts and src/raid/combat.ts, which import the display
export interface Crate {
  tier: number;
  d: number;
  vault?: boolean;
}

export const tierOf = (s: CrateSpot) => {
  if (!s.inside) return 0;
  return s.ring === CORE && Math.random() < 0.6 ? 2 : 1;
};

function vaultLoot(c: Crate): Item[] {
  return Array.from({ length: 3 }, () => {
    let it = rollItem(c.d, { minR: 2 });
    while (it.k === "med") it = rollItem(1, { minR: 2 });
    return it;
  });
}

export function crateLoot(c: Crate): Item[] {
  const n = (base: number) => base + (Math.random() < 0.5 ? 1 : 0);
  if (c.vault) return vaultLoot(c);
  if (c.tier === 0) return [Math.random() < 0.3 ? mk(pick(["bandage", "bandage", "med"] as const)) : rollItem(c.d * 0.4)];
  if (c.tier === 1) return Array.from({ length: n(1) }, () => rollItem(c.d, { shield: ROOM_SHIELDS }));
  return Array.from({ length: n(2) }, () => rollItem(c.d, { minR: 1, kit: true, shield: MILITARY_SHIELDS }));
}

/** The vault key a crate sometimes holds. */
export const crateKey = (c: Crate) => c.tier > 0 && !c.vault && Math.random() < 0.07 + 0.05 * c.d;

type Group = [weight: number, members: [Kind, number][]];

/** spawnTable() of src/raid/enemies.ts, with each pack spelt out as its average head count per kind. */
function groups(tier: number, adds: Kind[]): Group[] {
  const opt = (k: Kind, w: number) => (adds.includes(k) ? w : 0);
  if (tier === 0)
    return [
      [85, [["walker", 1]]],
      [opt("bloat", 15), [["bloat", 1]]],
    ];
  if (tier === 1)
    return [
      [40, [["runner", 2.5]]],
      [35, [["walker", 1]]],
      [15, [["gunner", 1]]],
      [opt("bloat", 15), [["bloat", 1]]],
      [
        opt("alpha", 15),
        [
          ["alpha", 1],
          ["runner", 3],
        ],
      ],
    ];
  return [
    [30, [["gunner", 1.5]]],
    [25, [["walker", 1]]],
    [opt("bloat", 12), [["bloat", 1]]],
    [
      opt("smg", 14),
      [
        ["smg", 1],
        ["gunner", 0.5],
      ],
    ],
    [opt("sniper", 12), [["sniper", 1]]],
    [
      opt("shield", 14),
      [
        ["shield", 1],
        ["gunner", 0.5],
      ],
    ],
    [opt("stalker", 12), [["stalker", 1.4]]],
    [
      opt("alpha", 12),
      [
        ["alpha", 1],
        ["runner", 3],
      ],
    ],
  ];
}

const mixes = new Map<string, [Kind, number][]>();

/** Head count share of each kind in a ring of a zone. */
function mix(z: Zone, ring: number): [Kind, number][] {
  const key = z.name + ring;
  const known = mixes.get(key);
  if (known) return known;
  const tier = Math.min(2, ring + (z.lo >= 0.5 ? 1 : 0));
  const heads = new Map<Kind, number>();
  for (const [w, members] of groups(tier, z.adds)) for (const [k, n] of members) heads.set(k, (heads.get(k) || 0) + w * n);
  const out = [...heads.entries()];
  mixes.set(key, out);
  return out;
}

export function killKind(z: Zone, ring: number): Kind {
  const m = mix(z, ring);
  let roll = Math.random() * m.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of m) {
    roll -= w;
    if (roll < 0) return k;
  }
  return "walker";
}

const ELITE: Kind[] = ["smg", "sniper", "shield", "alpha", "stalker", "boss"];

export function killDrops(kind: Kind): Item[] {
  const out: Item[] = [];
  const elite = ELITE.includes(kind);
  if (Math.random() < (kind === "boss" ? 1 : 0.5 + (elite ? 0.25 : 0))) out.push(mk(partOf(kind)));
  if (kind === "boss") return [...out, mk("vkey"), rollItem(1, { minR: 2 }), rollItem(1, { minR: 2 })];
  if (kind !== "bloat" && (kind === "gunner" || elite) && Math.random() < 0.2) out.push(mk("vkey"));
  return out;
}
