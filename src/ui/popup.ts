import { RAR, def, desc, nameOf, valOf, type Item } from "../items";
import { icon } from "./icons";

/** Diablo-style tooltip card pinned to the tapped item (`data-pin`); tapping outside closes it. */
export function popup(it: Item, extra: string[], btns: string[], priced = true) {
  const d = def(it.k),
    r = RAR[d.r];
  const stats = desc(it)
    .split(" · ")
    .filter((l) => l !== r);
  return `<div class="scrim" data-a="close"></div><div class="card detail" role="dialog" data-for="${it.u}" style="--rc:var(--r${d.r})">
    <button class="x" data-a="close" aria-label="Fermer">${icon("close")}</button><b>${nameOf(it)}</b><small class="rar">${r}</small>
    <ul>${stats.map((l) => `<li>${l}</li>`).join("")}</ul>
    <small>${[`${d.s} place${d.s > 1 ? "s" : ""}`, priced ? `${valOf(it)} cr` : "", ...extra].filter(Boolean).join(" · ")}</small>
    ${btns.some(Boolean) ? `<div class="btns">${btns.join("")}</div>` : ""}</div>`;
}

const GAP = 8,
  EDGE = 12;

/** Place the open popup above its item, or below when there is no room, kept inside the screen. */
export function pin(root: HTMLElement) {
  const pop = root.querySelector<HTMLElement>(".detail[data-for]");
  const at = pop && root.querySelector<HTMLElement>(`[data-pin="${pop.dataset.for}"]`);
  if (!pop || !at) return;
  const a = at.getBoundingClientRect(),
    p = pop.getBoundingClientRect(),
    vw = innerWidth,
    vh = innerHeight;
  const above = a.top - GAP - p.height >= EDGE;
  const top = above ? a.top - GAP - p.height : Math.min(a.bottom + GAP, vh - EDGE - p.height);
  pop.style.top = Math.max(EDGE, top) + "px";
  pop.style.left = Math.min(Math.max(EDGE, a.left + a.width / 2 - p.width / 2), vw - EDGE - p.width) + "px";
  pop.style.visibility = "visible";
}
