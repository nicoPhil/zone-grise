import { PART_SELL, RECIPES, SELL_R, STATIONS, STOCK } from "../src/economy";
import { UNLOCK_AFTER } from "../src/zones";
import { BASE, type Econ } from "./econ";

/** The economy the game ships, read from its own tables (tuned as variant v8 on 2026-10-25). */
export const GAME: Econ = {
  name: "game",
  sell: SELL_R[0],
  sellR: SELL_R,
  partSell: PART_SELL,
  freeKit: true,
  unlock: UNLOCK_AFTER,
  upScale: 1,
  benchRarity: 0.5,
  stock: STOCK,
  recycle: true,
  stations: { bench: STATIONS.bench.cost, pocket: STATIONS.pocket.cost, trade: STATIONS.trade.cost },
  recipes: RECIPES,
};

/** The economy before the stations, recipes and resale by rarity: full resale, 3 extractions per zone, upgrades at half price;
 * contracts keep the game's pay per zone (QUEST_ZONE), so they weigh a little more than they did. */
export const BEFORE: Econ = { ...BASE, name: "before", upScale: 0.5 };

export const VARIANTS: Record<string, Econ> = { before: BEFORE, game: GAME };
