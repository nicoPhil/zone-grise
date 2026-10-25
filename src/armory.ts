import type { AttDef, AttSlot } from "./attach";
import { def, mounted, type Item } from "./items";
import { S } from "./state";

const slotOfAtt = (it: Item): AttSlot | null => {
  const d = def(it.k);
  return d.t === "att" ? (d as AttDef).slot : null;
};

/** Mounts a stash attachment on the worn gun, sending back to the stash the one it replaces; false when there is no gun. */
export function mount(u: string): boolean {
  const gun = S.lo.eq.gun,
    i = S.stash.findIndex((it) => it.u === u),
    slot = i >= 0 ? slotOfAtt(S.stash[i]) : null;
  if (!gun || !slot) return false;
  const [a] = S.stash.splice(i, 1),
    old = gun.att?.[slot];
  if (old) S.stash.push(old);
  gun.att = { ...gun.att, [slot]: a };
  return true;
}

/** Takes an attachment off the worn gun, back to the stash. */
export function unmount(slot: AttSlot): boolean {
  const gun = S.lo.eq.gun,
    a = gun?.att?.[slot];
  if (!gun || !a) return false;
  S.stash.push(a);
  delete gun.att?.[slot];
  return true;
}

/** Takes every attachment off a gun about to be sold or recycled, and returns them. */
export function strip(gun: Item): Item[] {
  const out = mounted(gun);
  delete gun.att;
  return out;
}

/** Whether the worn gun has this attachment's slot free. */
export const freeOnGun = (it: Item) => {
  const slot = slotOfAtt(it),
    gun = S.lo.eq.gun;
  return !!slot && !!gun && !gun.att?.[slot];
};
