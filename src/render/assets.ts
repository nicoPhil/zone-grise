// sprites: Kenney "Topdown Shooter" (CC0), public/assets/KENNEY-LICENSE.txt
import { ctx } from "./canvas";

export type Tile = [number, number];
export const T = 64;
const CHAR = {
  pGun: [110, 352, 51, 43],
  pMach: [110, 396, 51, 43],
  pSil: [0, 220, 56, 43],
  sold: [110, 220, 52, 43],
  zomb: [300, 88, 35, 43],
} as const;
export type CharKey = keyof typeof CHAR;

interface Assets {
  ch: HTMLImageElement;
  ti: HTMLImageElement;
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

function whiteCopy(img: HTMLImageElement, [x, y, w, h]: readonly number[]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(img, x, y, w, h, 0, 0, w, h);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  return c;
}

export const assetsReady: Promise<void> = Promise.all([loadImg("assets/characters.png"), loadImg("assets/tiles.png")]).then(
  ([ch, ti]) => {
    const white = {} as Record<CharKey, HTMLCanvasElement>;
    for (const k of Object.keys(CHAR) as CharKey[]) white[k] = whiteCopy(ch, CHAR[k]);
    const floors = [1, 2, 3].map((r) => {
      const c = document.createElement("canvas");
      c.width = c.height = T;
      c.getContext("2d")!.drawImage(ti, 14 * T, r * T, T, T, 0, 0, T, T);
      return ctx.createPattern(c, "repeat")!;
    });
    A = { ch, ti, white, floors };
  },
);

export const floorPattern = (i: number) => A.floors[i];
export const tile = ([c, r]: Tile, x: number, y: number, s: number) => ctx.drawImage(A.ti, c * T, r * T, T, T, x, y, s, s);

export function shadow(x: number, y: number, r: number) {
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 6, r, r * 0.8, 0, 0, 6.28);
  ctx.fill();
}

export function sprite(key: CharKey, x: number, y: number, a: number, hit: boolean, s = 0.85) {
  const [sx, sy, w, h] = CHAR[key];
  shadow(x, y, 12);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  // the body sits 17px from the sprite's left edge; the gun sticks out to the right
  if (hit) ctx.drawImage(A.white[key], -17, -h / 2);
  else ctx.drawImage(A.ch, sx, sy, w, h, -17, -h / 2, w, h);
  ctx.restore();
}
