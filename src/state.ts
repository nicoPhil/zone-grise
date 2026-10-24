import { isItemKey, type Item, type ItemKey } from "./items";

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
  lo: { w: Item | null; a: Item | null; meds: number; keys: number };
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
  lo: { w: null, a: null, meds: 0, keys: 0 },
  st: { raids: 0, ext: 0, dead: 0, best: 0 },
  up: { bag: 0, meds: 0, hp: 0 },
  q: [],
  zone: 0,
  zx: [0, 0, 0],
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
  return {
    ...fresh(),
    ...s,
    stash: s.stash.filter((i) => isItemKey(i?.k)),
    lo: { w: ok(s.lo.w), a: ok(s.lo.a), meds: s.lo.meds || 0, keys: s.lo.keys || 0 },
    up: { ...fresh().up, ...s.up },
    q: Array.isArray(s.q) ? s.q : [],
    // extractions made before zones existed all happened in the first zone
    zx: Array.isArray(s.zx) ? s.zx : [s.st.ext || 0, 0, 0],
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
