import { $ } from "../util";
import { context2d } from "./context";

export const cv = $("cv") as HTMLCanvasElement;
export const ctx = context2d(cv);
// offscreen darkness layer: filled, then the line-of-sight polygon is cut out of it
export const shade = document.createElement("canvas");
export const sg = context2d(shade);
export const view = { dpr: 1, vw: 0, vh: 0, zoom: 1 };

const COLORS = ["ground", "fg", "accent", "ok", "bad", "shield", "enemy2", "r0", "r1", "r2", "r3"] as const;
export const C = {} as Record<(typeof COLORS)[number], string>;
export let FONT = "sans-serif";
export const rarCol = (r: number) => [C.r0, C.r1, C.r2, C.r3][r];

export function resize() {
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  view.vw = innerWidth;
  view.vh = innerHeight;
  cv.width = shade.width = view.vw * view.dpr;
  cv.height = shade.height = view.vh * view.dpr;
  view.zoom = Math.min(1, Math.min(view.vw, view.vh) / 560);
}

/** Reads the palette from the CSS tokens, so canvas and HTML share one set of colours. */
export function initCanvas() {
  const css = getComputedStyle(document.documentElement);
  for (const k of COLORS) C[k] = css.getPropertyValue("--" + k).trim();
  FONT = css.getPropertyValue("--f-display");
  addEventListener("resize", resize);
  resize();
}
