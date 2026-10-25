import { RAR, SHOP, desc, mk, price, upgradeOver, type ItemKey } from "../items";
import { STATIONS, restock } from "../economy";
import { S } from "../state";
import { icon } from "./icons";
import { row } from "./row";

const SHOP_PIN = "shop:",
  STOCK_PIN = "stock:";

const buyBtn = (k: ItemKey, at = "") =>
  `<button data-a="buy" data-k="${k}" ${at ? `data-at="${at}"` : ""} ${S.credits >= price(k) ? "" : "disabled"} aria-label="Acheter">${icon("buy")}${price(k)}</button>`;

export function tabTrade() {
  restock();
  const fixed = SHOP.map((k) => row({ k, u: SHOP_PIN + k }, `<div class="btns">${buyBtn(k)}</div>`));
  const better = (k: ItemKey) =>
    [desc(mk(k)), upgradeOver(mk(k), S.lo.eq) ? `<span class="better">↑ mieux que l'équipé</span>` : ""].filter(Boolean).join(" · ");
  const stock = S.stock.k.map((k, i) => row({ k, u: STOCK_PIN + i }, `<div class="btns">${buyBtn(k, String(i))}</div>`, better(k)));
  const cap = RAR[S.sta.trade].toLowerCase();
  return `<div class="card"><div class="lbl">Marchand</div>${fixed.join("")}</div>
    <div class="card"><div class="lbl">Arrivage · jusqu'à ${cap}</div>${stock.length ? stock.join("") : `<p class="empty">Tout est parti. Nouvel arrivage après ton prochain raid.</p>`}
      <p class="note">Nouvel arrivage après chaque raid. Le ${STATIONS.trade.n} de l'atelier fait monter la rareté.</p></div>`;
}

/** The item a market line stands for, and its buy button, for the stash popup. */
export function marketPick(pin: string): { k: ItemKey; btn: string } | null {
  if (pin.startsWith(SHOP_PIN)) {
    const k = pin.slice(SHOP_PIN.length) as ItemKey;
    return { k, btn: buyBtn(k) };
  }
  if (!pin.startsWith(STOCK_PIN)) return null;
  const at = pin.slice(STOCK_PIN.length),
    k = S.stock.k[Number(at)];
  return k ? { k, btn: buyBtn(k, at) } : null;
}

function buy(b: HTMLElement) {
  const k = b.dataset.k as ItemKey,
    at = b.dataset.at;
  if (S.credits < price(k)) return;
  if (at !== undefined) {
    if (S.stock.k[Number(at)] !== k) return;
    S.stock.k.splice(Number(at), 1);
  }
  S.credits -= price(k);
  S.stash.push(mk(k));
}

export const MARKET_ACTIONS = { buy };
