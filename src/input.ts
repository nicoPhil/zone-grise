import { cv } from "./render/canvas";
import { mode } from "./state";
import type { Pt } from "./util";

interface Stick {
  id: number;
  bx: number;
  by: number;
  x: number;
  y: number;
}

const FIRE_KEY = "zone-grise-fire";
/** Per-device preference: auto-attack on or off (off = stealth). */
export const prefs = { fire: true };
try {
  prefs.fire = localStorage.getItem(FIRE_KEY) !== "off";
} catch {
  // storage blocked: attack stays on
}
export function toggleFire() {
  prefs.fire = !prefs.fire;
  try {
    localStorage.setItem(FIRE_KEY, prefs.fire ? "on" : "off");
  } catch {
    // the toggle still works for this session
  }
}

/** Floating joystick: wherever the thumb lands becomes its centre. */
export let stick: Stick | null = null;
const keys: Record<string, boolean> = {};
export const STICK_R = 55;
export const clearStick = () => {
  stick = null;
};

export function moveVec(): Pt {
  let x = 0, y = 0;
  if (stick) {
    x = (stick.x - stick.bx) / STICK_R;
    y = (stick.y - stick.by) / STICK_R;
  }
  if (keys.w || keys.z || keys.arrowup) y -= 1;
  if (keys.s || keys.arrowdown) y += 1;
  if (keys.a || keys.q || keys.arrowleft) x -= 1;
  if (keys.d || keys.arrowright) x += 1;
  const l = Math.hypot(x, y);
  if (l < 0.18) return { x: 0, y: 0 };
  return l > 1 ? { x: x / l, y: y / l } : { x, y };
}

export function initInput(h: { toggleBag: () => void; onMove: () => void; onFire: () => void }) {
  cv.addEventListener("pointerdown", (e) => {
    if (mode !== "raid" || stick) return;
    stick = { id: e.pointerId, bx: e.clientX, by: e.clientY, x: e.clientX, y: e.clientY };
    cv.setPointerCapture(e.pointerId);
    h.onMove();
  });
  cv.addEventListener("pointermove", (e) => {
    if (stick && e.pointerId === stick.id) {
      stick.x = e.clientX;
      stick.y = e.clientY;
    }
  });
  const end = (e: PointerEvent) => {
    if (stick && e.pointerId === stick.id) stick = null;
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if ((mode === "raid" || mode === "bag") && (e.key === "Escape" || k === "b")) h.toggleBag();
    if (mode === "raid" && k === "f" && !e.repeat) h.onFire();
    if (mode === "raid") h.onMove();
  });
  addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });
}
