import type { Pt } from "../../../src/util";

export const prefs = { fire: true };
/** The bot's stick, read by the raid loop every frame. */
export const pad: Pt = { x: 0, y: 0 };
export const moveVec = (): Pt => ({ ...pad });
export const clearStick = () => {};
