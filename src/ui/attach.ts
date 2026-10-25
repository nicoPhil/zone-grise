import { freeOnGun, mount, unmount } from "../armory";
import { ATT_SLOTS, type AttSlot } from "../attach";
import { def, type Item } from "../items";
import { S } from "../state";
import { toast } from "./hud";
import { icon } from "./icons";

export const isAtt = (it: Item) => def(it.k).t === "att";

/** Button that mounts a stash attachment on the worn gun. */
export const mountBtn = (it: Item, label = "") =>
  isAtt(it)
    ? `<button data-a="mount" data-u="${it.u}" ${S.lo.eq.gun ? "" : "disabled"} aria-label="Monter sur l'arme">${icon("attach")}${label}</button>`
    : "";

export const attTag = (it: Item) => (freeOnGun(it) ? `<span class="better">↑ emplacement libre sur ton arme</span>` : "");

/** One button per attachment on the worn gun, to take it off. */
export function unmountBtns(gun: Item): string[] {
  return (Object.keys(ATT_SLOTS) as AttSlot[]).flatMap((s) => {
    const a = gun.att?.[s];
    return a ? [`<button data-a="unmount" data-s="${s}">${icon("unequip")}Démonter ${def(a.k).n}</button>`] : [];
  });
}

export const ATTACH_ACTIONS = {
  mount: (b: HTMLElement) => {
    if (b.dataset.u && mount(b.dataset.u)) toast("Monté sur l'arme");
  },
  unmount: (b: HTMLElement) => {
    const s = b.dataset.s as AttSlot | undefined;
    if (s && s in ATT_SLOTS && unmount(s)) toast("Démonté : au coffre");
  },
};
