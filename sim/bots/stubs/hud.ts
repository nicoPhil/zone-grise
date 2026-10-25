/** Toasts of the raid in progress, so a bot can be debugged from what the player would have read. */
export const toasts: string[] = [];
export const toast = (msg: string) => {
  toasts.push(msg);
};
export const setRaidHud = () => {};
export const showHint = () => {};
export const updHud = () => {};
