import { def, desc, nameOf, type Item } from "../items";

/** One line of an item list: coloured name, a detail line, and the actions on the right. */
export const row = (it: Item, btns: string, extra = "", n = 1) =>
  `<div class="item" ${pinned(it.u)}><div class="nm"><b style="color:var(--r${def(it.k).r})">${nameOf(it)}${n > 1 ? ` <span class="qty">×${n}</span>` : ""}</b><small>${extra || desc(it)}</small></div>${btns}</div>`;

/** Attributes that make a list line open the item popup when tapped. */
export const pinned = (id: string) => `data-u="${id}" data-pin="${id}" role="button" tabindex="0"`;

export const valTag = (v: number) => `<span class="val">${v} cr</span>`;
