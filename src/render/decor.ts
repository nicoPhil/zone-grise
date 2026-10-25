import { pick, rnd, type Pt, type Rect } from "../util";
import { inWall } from "../world/geometry";
import { H, W, depth, inBld, type Building } from "../world/mapgen";
import { T, type Tile } from "./assets";
import { context2d } from "./context";
import type { Fit } from "./furniture";

export interface Decal {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
}
export interface Decor extends Pt {
  t: Tile;
  r: number;
  s: number;
}

export const GN = Math.ceil(W / T);
const DEBRIS: Tile[] = [
  [18, 9],
  [19, 9],
  [20, 9],
  [18, 10],
  [19, 10],
  [20, 10],
  [21, 10],
  [22, 10],
  [21, 9],
  [22, 9],
];
const LOOSE: Tile[] = [
  [20, 8],
  [21, 8],
  [22, 8],
  [25, 5],
  [23, 7],
  [18, 8],
  [19, 8],
  [22, 11],
];
const ASPHALT: Tile = [11, 1];
const DIRT = (): Tile => [Math.random() < 0.8 ? 4 : 5, 0];
const GRASS = (): Tile => [Math.floor(rnd(0, 4)), 0];
const PAVED = (): Tile => [pick([6, 6, 7, 7, 8]), 0];
const SLAB = (): Tile => [Math.floor(rnd(0, 7)), Math.floor(rnd(10, 16))];

/** A prop scattered outside the buildings: which tile, how many, and how big it's drawn. */
type Prop = [Tile[], number, number, number];
/** One look per zone: ground by depth (0 edge … 1 centre) and a smooth patch value q (0..1), props, stains, and an overall colour cast. */
export interface Theme {
  ground: (d: number, q: number) => Tile;
  props: Prop[];
  stains: string[];
  cast?: string;
  /** what the rooms hold, and how ransacked they are (0..1) */
  fit: Fit;
  mess: number;
}

const BUSH: Tile[] = [
    [20, 6],
    [18, 8],
    [20, 7],
    [23, 8],
  ],
  DEAD: Tile[] = [
    [23, 6],
    [19, 8],
  ];
const BARREL: Tile[] = [
    [18, 11],
    [19, 11],
    [20, 11],
  ],
  OIL: Tile[] = [
    [21, 11],
    [22, 11],
  ],
  CRATE: Tile[] = [
    [20, 4],
    [21, 4],
    [20, 5],
    [21, 5],
  ];
const ROCK: Tile[] = [
    [20, 8],
    [21, 8],
    [22, 8],
  ],
  WOOD: Tile[] = [
    [21, 9],
    [22, 9],
    [18, 10],
  ],
  TARP: Tile[] = [
    [22, 5],
    [22, 4],
  ];

export const THEMES: Theme[] = [
  // Faubourgs: gardens gone wild
  {
    ground: (d) => {
      if (d > 0.56) return PAVED();
      return d > 0.3 ? DIRT() : GRASS();
    },
    props: [
      [BUSH, 70, 34, 56],
      [DEAD, 20, 34, 50],
      [LOOSE, 110, 26, 40],
    ],
    stains: ["rgba(52,44,30,.35)", "rgba(0,0,0,.3)"],
    fit: "house",
    mess: 0.1,
  },
  // Zone industrielle: concrete yards, barrels and oil
  {
    ground: (d, q) => {
      if (d < 0.32) return DIRT();
      return q > 0.4 ? SLAB() : ASPHALT;
    },
    props: [
      [BARREL, 60, 34, 42],
      [OIL, 30, 50, 80],
      [CRATE, 30, 38, 48],
      [WOOD, 50, 30, 44],
      [LOOSE, 50, 26, 36],
    ],
    stains: ["rgba(10,10,10,.35)", "rgba(60,50,30,.3)"],
    fit: "industry",
    mess: 0.2,
  },
  // Cœur: cracked tarmac and rubble
  {
    ground: (d, q) => (q > 0.6 + 0.3 * d ? SLAB() : ASPHALT),
    props: [
      [ROCK, 110, 26, 44],
      [WOOD, 50, 30, 44],
      [OIL, 25, 50, 80],
      [CRATE, 15, 38, 48],
    ],
    stains: ["rgba(0,0,0,.35)", "rgba(40,36,30,.3)"],
    cast: "rgba(20,20,30,.12)",
    fit: "house",
    mess: 0.45,
  },
  // Quarantaine: pale slabs, tents and supply crates
  {
    ground: (d, q) => (q < 0.45 - 0.2 * d ? SLAB() : PAVED()),
    props: [
      [TARP, 40, 70, 96],
      [CRATE, 60, 38, 52],
      [[[19, 11]], 30, 34, 42],
      [LOOSE, 40, 26, 36],
    ],
    stains: ["rgba(0,0,0,.18)", "rgba(40,70,60,.15)"],
    cast: "rgba(120,160,150,.08)",
    fit: "camp",
    mess: 0.15,
  },
  // Épicentre: scorched ground, craters and embers
  {
    ground: (d, q) => (q < 0.3 - 0.2 * d ? DIRT() : ASPHALT),
    props: [
      [OIL, 90, 60, 110],
      [ROCK, 80, 26, 44],
      [DEAD, 50, 34, 50],
      [WOOD, 40, 30, 44],
    ],
    stains: ["rgba(0,0,0,.6)", "rgba(0,0,0,.45)", "rgba(170,50,10,.3)"],
    cast: "rgba(110,25,0,.22)",
    fit: "house",
    mess: 0.85,
  },
];

/** Half-resolution layer under everything: dirt stains, then blood and casings stamped during the raid. */
export function makeDecal(th: Theme): Decal {
  const c = document.createElement("canvas");
  c.width = W / 2;
  c.height = H / 2;
  const g = context2d(c);
  g.scale(0.5, 0.5);
  for (let i = 0; i < 150; i++) {
    const x = rnd(0, W),
      y = rnd(0, H),
      r = rnd(30, 150),
      gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, pick(th.stains));
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  if (th.cast) {
    g.fillStyle = th.cast;
    g.fillRect(0, 0, W, H);
  }
  return { c, g };
}

/** The zone's ground, varying from the edge to the centre where the loot is best. */
export function makeGround(th: Theme): Tile[] {
  const s1 = rnd(0, 9),
    s2 = rnd(0, 9),
    s3 = rnd(0, 9),
    s4 = rnd(0, 9),
    m: Tile[] = new Array(GN * GN);
  for (let j = 0; j < GN; j++)
    for (let i = 0; i < GN; i++) {
      const n = 0.12 * Math.sin(i * 0.45 + s1) * Math.cos(j * 0.38 + s2) + rnd(-0.04, 0.04);
      const d = depth((i + 0.5) * T, (j + 0.5) * T) + n;
      // low-frequency patches, so ground types form areas instead of a checkerboard
      const q = 0.5 + 0.35 * Math.sin(i * 0.33 + s3) * Math.cos(j * 0.29 + s4) + 0.15 * Math.sin((i + j) * 0.17 + s1) + rnd(-0.05, 0.05);
      m[j * GN + i] = th.ground(d, q);
    }
  return m;
}

export function makeDecor(walls: Rect[], bld: Building[], th: Theme): Decor[] {
  const out: Decor[] = [];
  for (const w of walls.slice(4))
    for (let i = 0; i < (w.w + w.h) / 60; i++) {
      const x = rnd(w.x - 30, w.x + w.w + 30),
        y = rnd(w.y - 30, w.y + w.h + 30);
      if (!inWall(walls, x, y, 6)) out.push({ x, y, t: pick(DEBRIS), r: rnd(0, 6.28), s: rnd(30, 44) });
    }
  for (const [tiles, n, s0, s1] of th.props)
    for (let i = 0; i < n; i++) {
      const x = rnd(40, W - 40),
        y = rnd(40, H - 40);
      if (!inWall(walls, x, y, s1 / 3) && !inBld(bld, x, y, 10)) out.push({ x, y, t: pick(tiles), r: rnd(0, 6.28), s: rnd(s0, s1) });
    }
  return out;
}

export function blood({ g }: Decal, { x, y }: Pt, n: number, big: boolean) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28),
      d = big ? rnd(0, 24) : rnd(4, 18),
      r = big ? rnd(3, 11) : rnd(1.5, 4);
    g.fillStyle = `rgba(${Math.round(rnd(85, 125))},12,16,${rnd(0.55, 0.85).toFixed(2)})`;
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, 6.28);
    g.fill();
  }
}

export function stampCasing({ g }: Decal, x: number, y: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = "#9c7a35";
  g.fillRect(-3, -1.2, 6, 2.4);
  g.restore();
}
