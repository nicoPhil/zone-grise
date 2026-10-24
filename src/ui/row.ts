import { def, desc, nameOf, type Item } from "../items";

/** One line of an item list: coloured name, a detail line, and the actions on the right. */
export const row = (it: Item, btns: string, extra = "", n = 1) =>
  `<div class="item"><div class="nm"><b style="color:var(--r${def(it.k).r})">${nameOf(it)}${n > 1 ? ` <span class="qty">×${n}</span>` : ""}</b><small>${extra || desc(it)}</small></div>${btns}</div>`;

export const valTag = (v: number) => `<span class="val">${v} cr</span>`;
