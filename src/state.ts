import { emptyGear, isItemKey, slotOf, type Gear, type Item, type ItemKey, type Slot } from "./items";

export type Mode = "stash" | "raid" | "bag" | "end";
export type QuestType = "bring" | "kills" | "violet" | "haul" | "vault" | "boss";
export interface Quest {
  u: string;
  t: QuestType;
  k?: ItemKey;
  n: number;
  have: number;
  cr: number;
  rew?: ItemKey;
}
export interface Upgrades {
  bag: number;
  meds: number;
  hp: number;
}
/** Hideout stations: the bench caps bench levels and unlocks recipes, the pocket keeps bag places at death, the trade post raises the merchant's stock, the store enlarges the stash. */
export interface Stations {
  bench: number;
  pocket: number;
  trade: number;
  store: number;
}
/** One raid as the share report shows it. */
export interface RaidLog {
  /** raid number, zone index, extracted or not */
  n: number;
  z: number;
  ok: boolean;
  /** seconds spent in the raid */
  t: number;
  /** value brought out, or lost at death */
  val: number;
  kills: number;
  boss: number;
  vaults: number;
  violet: number;
  /** deepest ring reached, HP lost, HP left */
  deep: number;
  dmg: number;
  hp: number;
  /** seconds in the Cœur, average seconds from first hit to kill; missing in logs from before they were kept */
  core?: number;
  ttk?: number;
  /** HP lost in the Cœur */
  dmgCore?: number;
  /** gun bullets fired, hits, kills */
  gun?: { fired: number; hits: number; kills: number };
  /** power going in, credits and stash value after */
  pw: number;
  cr: number;
  sv: number;
}
export const LOG_MAX = 60;

export interface Save {
  credits: number;
  stash: Item[];
  /** what the character wears into the raid; an empty blade slot means the free knife */
  lo: { eq: Gear; meds: number; keys: number };
  st: { raids: number; ext: number; dead: number; best: number };
  up: Upgrades;
  sta: Stations;
  /** the merchant's rotating pieces, drawn again once per raid played */
  stock: { raid: number; items: Item[] };
  q: Quest[];
  /** selected zone, and extractions made in each zone */
  zone: number;
  zx: number[];
  /** highest zone open to the player */
  opened: number;
  /** the last raids, newest last */
  log: RaidLog[];
}

export const KEY = "zone-grise-save";
export const fresh = (): Save => ({
  credits: 250,
  stash: [],
  lo: { eq: emptyGear(), meds: 0, keys: 0 },
  st: { raids: 0, ext: 0, dead: 0, best: 0 },
  up: { bag: 0, meds: 0, hp: 0 },
  sta: { bench: 0, pocket: 0, trade: 0, store: 0 },
  stock: { raid: -1, items: [] },
  q: [],
  zone: 0,
  zx: [0, 0, 0, 0, 0],
  opened: 0,
  log: [],
});

export let S: Save = fresh();
export let mode: Mode = "stash";
export const setMode = (m: Mode) => {
  mode = m;
};
export const setSave = (s: Save) => {
  S = s;
};

const preZoneExtractions = (zone: number, none: number, s: Partial<Save>) => (zone ? none : s.st?.ext || 0);
/** Saves from before `opened` kept zones open after 3 extractions in the one before. */
const OLD_UNLOCK = 3;
const openedBefore = (zx: number[]) => zx.reduce((o, n, i) => (i === o && n >= OLD_UNLOCK ? i + 1 : o), 0);

// extractions made before zones existed all happened in the first zone
const zoneExtractions = (s: Partial<Save>) => fresh().zx.map((z, i) => (Array.isArray(s.zx) ? s.zx[i] || 0 : preZoneExtractions(i, z, s)));

const stockOf = (s: Partial<Save>): Save["stock"] =>
  s.stock && Array.isArray(s.stock.items) ? { raid: s.stock.raid, items: s.stock.items.filter((i) => isItemKey(i?.k)) } : fresh().stock;

const logOf = (s: Partial<Save>) => (Array.isArray(s.log) ? s.log.slice(-LOG_MAX) : []);

// saves written before the progression update have no `up` / `q`; unknown item keys are dropped
export function parseSave(raw: string | null): Save {
  let s: Partial<Save> | null = null;
  try {
    s = raw ? JSON.parse(raw) : null;
  } catch {
    return fresh();
  }
  if (!s || typeof s.credits !== "number" || !Array.isArray(s.stash) || !s.lo || !s.st) return fresh();
  const ok = (it: Item | null | undefined) => (it && isItemKey(it.k) ? it : null);
  // older saves kept one weapon (w), then a gun and a blade (w, m), and armour (a): each piece goes to its own slot
  const eq = emptyGear();
  const old = s.lo as Partial<Record<"w" | "m" | "a", Item>> & { eq?: Partial<Gear> };
  for (const it of [...Object.values(old.eq || {}), old.w, old.m, old.a]) {
    const i = ok(it),
      slot: Slot | null = i && slotOf(i);
    if (i && slot && !eq[slot]) eq[slot] = i;
  }
  const zx = zoneExtractions(s);
  return {
    ...fresh(),
    ...s,
    stash: s.stash.filter((i) => isItemKey(i?.k)),
    lo: { eq, meds: s.lo.meds || 0, keys: s.lo.keys || 0 },
    up: { ...fresh().up, ...s.up },
    sta: { ...fresh().sta, ...s.sta },
    stock: stockOf(s),
    q: Array.isArray(s.q) ? s.q : [],
    zx,
    opened: typeof s.opened === "number" ? s.opened : openedBefore(zx),
    zone: typeof s.zone === "number" ? s.zone : 0,
    log: logOf(s),
  };
}

/** Dev tool: back to a new player's save, items, credits, upgrades and stats included. */
export function resetSave() {
  S = fresh();
  save();
}

export function loadLocal() {
  try {
    S = parseSave(localStorage.getItem(KEY));
  } catch {
    S = fresh();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    // private mode or full storage: the game keeps running on the in-memory save
  }
}
