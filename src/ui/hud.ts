import { bagUsed, wstat } from "../items";
import { cap } from "../progression";
import type { Raid } from "../raid";
import { prefs } from "../input";
import { C } from "../render/canvas";
import { $, clamp } from "../util";

let toastTimer = 0;
export function toast(msg: string) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove("on"), 1800);
}

export const hideHint = () => {
  $("hint").style.opacity = "0";
};
export function showHint(melee: boolean) {
  const h = $("hint");
  h.textContent = melee ? "Glisse pour bouger · Tu frappes au contact" : "Glisse pour bouger · Arrête-toi pour tirer";
  h.hidden = false;
  h.style.opacity = "1";
  setTimeout(hideHint, 5000);
}

export function setRaidHud(on: boolean) {
  $("hud").hidden = !on;
  $("act").hidden = !on;
  $("stash").hidden = on || $("stash").hidden;
  $("end").hidden = true;
  $("bag").hidden = true;
  if (!on) $("hint").hidden = true;
  updFire();
}

export function updFire() {
  const b = $("bFire");
  b.textContent = prefs.fire ? "Tir auto" : "Tir coupé";
  b.setAttribute("aria-pressed", String(prefs.fire));
}

export function updHud(r: Raid) {
  const p = r.p, f = clamp(p.hp / p.max, 0, 1), s = Math.max(0, Math.ceil(r.t));
  $("hpfill").style.width = f * 100 + "%";
  $("hpfill").style.background = f < 0.35 ? C.bad : C.ok;
  $("hptxt").textContent = Math.ceil(Math.max(0, p.hp)) + " PV";
  $("timer").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  $("timer").classList.toggle("warn", s <= 60);
  const keys = r.p.keys + r.bag.filter((i) => i.k === "vkey").length;
  $("bagc").textContent = "Sac " + bagUsed(r.bag) + "/" + cap() + (keys ? ` · ${keys} clé${keys > 1 ? "s" : ""}` : "");
  // the fire toggle only matters with a gun in hand
  $("bFire").hidden = !!wstat(p.wpn).mel;
  $("bHeal").textContent = "Soin (" + (p.meds + r.bag.filter((i) => i.k === "med").length) + ")";
}
