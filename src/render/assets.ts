// sprites: Kenney "Topdown Shooter" (CC0), public/assets/KENNEY-LICENSE.txt
import { ctx } from "./canvas";

export type Tile = [number, number];
export const T = 64;
const CHAR = {
  pGun: [110, 352, 51, 43],
  pMach: [110, 396, 51, 43],
  pSil: [0, 220, 56, 43],
  pHold: [295, 264, 37, 43],
  sold: [110, 220, 52, 43],
  zomb: [300, 88, 35, 43],
  boss: [58, 132, 52, 43],
  soldM: [0, 88, 57, 43],
  robot: [161, 44, 49, 43],
  hitman: [161, 0, 49, 43],
} as const;
const TINTS = { zombR: "rgba(190,30,30,.45)", bloat: "rgba(120,175,40,.55)", stalker: "rgba(25,10,45,.65)", alpha: "rgba(120,0,0,.6)" };
// runners, bloaters, stalkers and pack leaders reuse the zombie frame, tinted
export type CharKey = keyof typeof CHAR | keyof typeof TINTS;

interface Assets {
  ti: HTMLImageElement;
  frames: Record<CharKey, HTMLCanvasElement>;
  white: Record<CharKey, HTMLCanvasElement>;
  floors: CanvasPattern[];
}
let A: Assets;

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = import.meta.env.BASE_URL + src;
  });

function crop(img: CanvasImageSource, [x, y, w, h]: readonly number[], fill?: string) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(img, x, y, w, h, 0, 0, w, h);
  if (fill) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
  }
  return c;
}

export const assetsReady: Promise<void> = Promise.all([loadImg("assets/characters.png"), loadImg("assets/tiles.png")]).then(([ch, ti]) => {
  const frames = {} as Record<CharKey, HTMLCanvasElement>,
    white = {} as Record<CharKey, HTMLCanvasElement>;
  for (const k of Object.keys(CHAR) as (keyof typeof CHAR)[]) frames[k] = crop(ch, CHAR[k]);
  for (const [k, c] of Object.entries(TINTS)) frames[k as keyof typeof TINTS] = crop(frames.zomb, [0, 0, CHAR.zomb[2], CHAR.zomb[3]], c);
  frames.boss = crop(frames.boss, [0, 0, CHAR.boss[2], CHAR.boss[3]], "rgba(70,8,8,.4)");
  for (const k of Object.keys(frames) as CharKey[]) white[k] = crop(frames[k], [0, 0, frames[k].width, frames[k].height], "#fff");
  const floors = [1, 2, 3].map((r) => ctx.createPattern(crop(ti, [14 * T, r * T, T, T]), "repeat")!);
  A = { ti, frames, white, floors };
});

export const floorPattern = (i: number) => A.floors[i];
export const tile = ([c, r]: Tile, x: number, y: number, s: number) => ctx.drawImage(A.ti, c * T, r * T, T, T, x, y, s, s);

export function shadow(x: number, y: number, r: number) {
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 6, r, r * 0.8, 0, 0, 6.28);
  ctx.fill();
}

export function sprite(key: CharKey, x: number, y: number, a: number, hit: boolean, s = 0.85) {
  const h = A.frames[key].height;
  shadow(x, y, 14 * s);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  // the body sits 17px from the sprite's left edge; the gun sticks out to the right
  ctx.drawImage((hit ? A.white : A.frames)[key], -17, -h / 2);
  ctx.restore();
}
