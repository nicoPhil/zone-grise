import { def, desc, nameOf, type Item } from "../items";

/** One line of an item list: coloured name, a detail line, and the actions on the right. */
export const row = (it: Item, btns: string, extra = "", n = 1) =>
  `<div class="item" ${pinned(it.u)}><div class="nm"><b style="color:var(--r${def(it.k).r})">${nameOf(it)}${n > 1 ? ` <span class="qty">×${n}</span>` : ""}</b><small>${extra || desc(it)}</small></div>${btns}</div>`;

/** Attributes that make a list line open the item popup when tapped. */
export const pinned = (id: string) => `data-u="${id}" data-pin="${id}" role="button" tabindex="0"`;

export const valTag = (v: number) => `<span class="val">${v} cr</span>`;

/** Copies of the same item at the same upgrade level share one list line. */
export const stackKey = (i: Item) => i.k + ":" + (i.lv || 0);

/** Groups items by `stackKey`, in order of first appearance. */
export function stacks(items: Item[]) {
  const g = new Map<string, Item[]>();
  for (const i of items) g.set(stackKey(i), [...(g.get(stackKey(i)) || []), i]);
  return [...g.values()];
}
