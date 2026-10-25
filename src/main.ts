import "./style.css";
import { initInput, prefs, toggleFire } from "./input";
import { norm } from "./progression";
import { R, clock, heal, update } from "./raid";
import { initCanvas } from "./render/canvas";
import { draw } from "./render/draw";
import { loadLocal, mode } from "./state";
import { closeBag, initBag, openBag, tickBag } from "./ui/bag";
import { initEnd } from "./ui/end";
import { hideHint, toast, updFire } from "./ui/hud";
import { mountIcons } from "./ui/icons";
import { initStash, renderStash } from "./ui/stash";
import { $, clamp } from "./util";

loadLocal();
mountIcons();
norm();
initCanvas();
initStash();
initBag();
initEnd();
function flipFire() {
  toggleFire();
  updFire();
  toast(prefs.fire ? "Tir automatique activé" : "Tir coupé : mode discret, lame seulement");
}
initInput({ toggleBag: () => (mode === "bag" ? closeBag() : openBag()), onMove: hideHint, onFire: flipFire });
$("bFire").addEventListener("click", () => mode === "raid" && flipFire());
$("bHeal").addEventListener("click", () => mode === "raid" && heal());
$("bBag").addEventListener("click", () => mode === "raid" && openBag());
renderStash();

function frame(now: number) {
  // the first frame of a raid can be stamped before startRaid reset the clock
  const dt = clamp((now - clock.last) / 1000, 0, 0.05);
  clock.last = now;
  if (mode === "raid" || mode === "bag") update(dt);
  if (mode === "bag") tickBag();
  draw(R);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
