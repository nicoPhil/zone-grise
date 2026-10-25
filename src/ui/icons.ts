import type { Slot } from "../items";

const BAG = '<path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M10 4V3h4v1M9 14h6v4H9z"/>';
const P = {
  fire: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  fireOff: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M4 4l16 16"/>',
  heal: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 10.5v6M9 13.5h6"/>',
  bag: BAG,
  back: BAG,
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3M16 7l3 3M14 9l2 2"/>',
  head: '<path d="M4 16a8 8 0 0 1 16 0M2 16h20v3H2zM12 8v4"/>',
  body: '<path d="M8 3l4 4 4-4 4 3v15H4V6zM12 7v14"/>',
  hands:
    '<path d="M7 21v-9V6.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V5.5a1.5 1.5 0 0 1 3 0V12V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7z"/>',
  feet: '<path d="M7 3h6v9l5 2.5a3 3 0 0 1 2 2.8V20H7zM7 17h13"/>',
  trinket: '<path d="M6 3l6 8 6-8"/><circle cx="12" cy="16" r="4"/>',
  gun: '<path d="M2 7h19v4h-8l-1 3H9l-1 5H4l1.5-8H2z"/>',
  blade: '<path d="M4 20l3-3M6 15l3 3M8 16 20 4c0 6-4 10.5-9 12.5"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="M8 12h8"/>',
  quest: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h4"/>',
  shop: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  trade: '<circle cx="9" cy="9" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18M8 7h1.5v4"/>',
  equip: '<circle cx="9" cy="7" r="4"/><path d="M2 21a7 7 0 0 1 14 0M22 11h-6M19 8l-3 3 3 3"/>',
  unequip: '<circle cx="9" cy="7" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 11h6M19 8l3 3-3 3"/>',
  sell: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  sellAll:
    '<path d="M9 5H3v6l8.3 8.3a2 2 0 0 0 2.8 0M13 2H8v5l8.3 8.3a2 2 0 0 0 2.8 0l2.3-2.3a2 2 0 0 0 0-2.8z"/><circle cx="11.5" cy="5.5" r="1"/>',
  buy: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  hammer: '<path d="M15 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9M17.6 15 22 10.6M20.9 11.7 12.3 3.1 9.5 5.9l1.6 1.6-2.1 2.1"/>',
  craft:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  recycle:
    '<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L7 10M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.2-2.1M14 16l-3 3 3 3M8.3 13.6 7 10l-3.7 1.2M9.3 5.6l1.1-1.9a1.8 1.8 0 0 1 3.1 0l3.9 6.7M13.4 9.1l3.4.4.6-3.6"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/>',
  attach: '<circle cx="12" cy="12" r="4"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  drop: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  take: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  use: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  stash: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
} satisfies Record<string, string> & Record<Slot, string>;

export type Icon = keyof typeof P;

/** Inline stroke icon in the current text colour; decorative, so the control carries the label. */
export const icon = (n: Icon) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

/** Fill the static `<i data-ic="…">` placeholders of the page. */
export function mountIcons() {
  for (const el of document.querySelectorAll<HTMLElement>("i[data-ic]")) el.outerHTML = icon(el.dataset.ic as Icon);
}
