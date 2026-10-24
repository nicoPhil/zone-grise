import { def, desc, nameOf, valOf, type Item } from "../items";
import { icon } from "./icons";

export const itemInfo = (it: Item) => `${desc(it)} · ${def(it.k).s} place${def(it.k).s > 1 ? "s" : ""} · ${valOf(it)} cr`;

/** Item detail popup near the thumb: what it is and the actions it allows; tapping outside closes it. */
export const popup = (it: Item, info: string, btns: string[]) =>
  `<div class="scrim" data-a="close"></div><div class="card detail" role="dialog"><b style="color:var(--r${def(it.k).r})">${nameOf(it)}</b>
    <small>${info}</small><div class="btns">${[...btns, `<button data-a="close" aria-label="Fermer">${icon("close")}</button>`].join("")}</div></div>`;
