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
export interface Save {
  credits: number;
  stash: Item[];
  /** what the character wears into the raid; an empty blade slot means the free knife */
  lo: { eq: Gear; meds: number; keys: number };
  st: { raids: number; ext: number; dead: number; best: number };
  up: Upgrades;
  q: Quest[];
  /** selected zone, and extractions made in each zone */
  zone: number;
  zx: number[];
}

export const KEY = "zone-grise-save";
export const fresh = (): Save => ({
  credits: 250,
  stash: [],
  lo: { eq: emptyGear(), meds: 0, keys: 0 },
  st: { raids: 0, ext: 0, dead: 0, best: 0 },
  up: { bag: 0, meds: 0, hp: 0 },
  q: [],
  zone: 0,
  zx: [0, 0, 0, 0, 0],
});

export let S: Save = fresh();
export let mode: Mode = "stash";
export const setMode = (m: Mode) => {
  mode = m;
};
export const setSave = (s: Save) => {
  S = s;
};

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
  return {
    ...fresh(),
    ...s,
    stash: s.stash.filter((i) => isItemKey(i?.k)),
    lo: { eq, meds: s.lo.meds || 0, keys: s.lo.keys || 0 },
    up: { ...fresh().up, ...s.up },
    q: Array.isArray(s.q) ? s.q : [],
    // extractions made before zones existed all happened in the first zone
    zx: fresh().zx.map((z, i) => (Array.isArray(s.zx) ? s.zx[i] || 0 : i ? z : s.st?.ext || 0)),
    zone: typeof s.zone === "number" ? s.zone : 0,
  };
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
