import { shieldOf, type Item, type ShieldStats } from "../items";

/** A worn shield's reserve: `calm` counts seconds since the last hit, `flash` and `broke` time the impact and break effects. */
export interface Shield extends ShieldStats {
  left: number;
  calm: number;
  flash: number;
  broke: number;
}

/** Worn from the start of a raid it is full; put on during a raid it starts empty. */
export function wornShield(it: Item | null, full: boolean): Shield | null {
  const s = shieldOf(it);
  return s && { ...s, left: full ? s.pts : 0, calm: 0, flash: 0, broke: 0 };
}

/** Takes what it can of a hit and returns how much; any hit, even on an empty shield, restarts the wait before recharging. */
export function absorb(sh: Shield | null, d: number): number {
  if (!sh) return 0;
  sh.calm = 0;
  const took = Math.min(sh.left, d);
  if (took <= 0) return 0;
  sh.left -= took;
  sh.flash = 0.15;
  if (sh.left <= 0) sh.broke = 0.4;
  return took;
}

export function recharge(sh: Shield | null, dt: number) {
  if (!sh) return;
  sh.calm += dt;
  sh.flash -= dt;
  sh.broke -= dt;
  if (sh.calm >= sh.delay) sh.left = Math.min(sh.pts, sh.left + sh.rate * dt);
}
