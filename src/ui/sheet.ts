import { icon } from "./icons";
import { SLOTS, def, modLines, nameOf, shieldOf, type Gear, type Mods, type Slot } from "../items";

const ORDER: Slot[] = ["trinket", "head", "back", "gun", "body", "blade", "hands", "feet", "shield"];

/** Diablo-style paper doll: one tile per slot around the body, then the summed bonuses. */
export function sheet(g: Gear, o: { st: Required<Mods>; hp: number; cap: number; sel?: string | null }) {
  const cells = ORDER.map((slot) => {
    const it = g[slot];
    const body = it
      ? `<b style="color:var(--r${def(it.k).r})">${nameOf(it)}</b>`
      : `<b class="none">${slot === "blade" ? "Couteau (kit)" : "Vide"}</b>`;
    return `<button class="slot${it ? "" : " empty"}" style="grid-area:${slot}" data-slot="${slot}"${it ? ` data-pin="${it.u}"` : ""} aria-pressed="${!!it && o.sel === it.u}"><small>${icon(slot)}${SLOTS[slot]}</small>${body}</button>`;
  });
  const sh = shieldOf(g.shield);
  const lines = [
    `${o.hp} PV`,
    ...(sh ? [`${sh.pts} pts de bouclier`] : []),
    `sac de ${o.cap} places`,
    ...modLines({ ...o.st, hp: 0, cap: 0 }),
  ];
  return `<div class="doll">${cells.join("")}</div><p class="stats">${lines.join(" · ")}</p>`;
}
