import { RAR, SHOP, desc, mk, price, priceOf, upgradeOver, type Item, type ItemKey } from "../items";
import { STATIONS, fits, restock, stashOver } from "../economy";
import { S } from "../state";
import { icon } from "./icons";
import { row } from "./row";

const SHOP_PIN = "shop:",
  STOCK_PIN = "stock:";

const buyBtn = (cost: number, data: string, it: Item) =>
  `<button data-a="buy" ${data} ${S.credits >= cost && fits(it) ? "" : "disabled"} aria-label="Acheter">${icon("buy")}${cost}</button>`;
const shopBtn = (k: ItemKey) => buyBtn(price(k), `data-k="${k}"`, mk(k));
const stockBtn = (it: Item) => buyBtn(priceOf(it), `data-u="${it.u}"`, it);

export function tabTrade() {
  restock();
  const fixed = SHOP.map((k) => row({ k, u: SHOP_PIN + k }, `<div class="btns">${shopBtn(k)}</div>`));
  const line = (it: Item) =>
    [desc(it), upgradeOver(it, S.lo.eq) ? `<span class="better">↑ mieux que l'équipé</span>` : ""].filter(Boolean).join(" · ");
  const stock = S.stock.items.map((it) => row({ ...it, u: STOCK_PIN + it.u }, `<div class="btns">${stockBtn(it)}</div>`, line(it)));
  const cap = RAR[S.sta.trade].toLowerCase();
  return `<div class="card"><div class="lbl">Marchand</div>${fixed.join("")}</div>
    <div class="card"><div class="lbl">Arrivage · jusqu'à ${cap}</div>${stock.length ? stock.join("") : `<p class="empty">Tout est parti. Nouvel arrivage après ton prochain raid.</p>`}
      ${stashOver() ? `<p class="note warn">Coffre plein : fais de la place pour acheter.</p>` : ""}<p class="note">Nouvel arrivage après chaque raid. Le ${STATIONS.trade.n} de l'atelier fait monter la rareté.</p></div>`;
}

/** The item a market line stands for, and its buy button, for the stash popup. */
export function marketPick(pin: string): { it: Item; btn: string } | null {
  if (pin.startsWith(SHOP_PIN)) {
    const k = pin.slice(SHOP_PIN.length) as ItemKey;
    return { it: { k, u: pin }, btn: shopBtn(k) };
  }
  const it = pin.startsWith(STOCK_PIN) && S.stock.items.find((i) => STOCK_PIN + i.u === pin);
  return it ? { it: { ...it, u: pin }, btn: stockBtn(it) } : null;
}

function buy(b: HTMLElement) {
  const k = b.dataset.k as ItemKey | undefined;
  if (k) {
    if (S.credits < price(k) || !fits(mk(k))) return;
    S.credits -= price(k);
    S.stash.push(mk(k));
    return;
  }
  const i = S.stock.items.findIndex((it) => it.u === b.dataset.u),
    it = S.stock.items[i];
  if (!it || S.credits < priceOf(it) || !fits(it)) return;
  S.credits -= priceOf(it);
  S.stash.push(...S.stock.items.splice(i, 1));
}

export const MARKET_ACTIONS = { buy };
