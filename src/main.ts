import "./style.css";
import { initInput } from "./input";
import { norm } from "./progression";
import { R, clock, heal, update } from "./raid";
import { initCanvas } from "./render/canvas";
import { draw } from "./render/draw";
import { loadLocal, mode } from "./state";
import { closeBag, initBag, openBag } from "./ui/bag";
import { initEnd } from "./ui/end";
import { hideHint } from "./ui/hud";
import { initStash, renderStash } from "./ui/stash";
import { $ } from "./util";

loadLocal();
norm();
initCanvas();
initStash();
initBag();
initEnd();
initInput({ toggleBag: () => (mode === "bag" ? closeBag() : openBag()), onMove: hideHint });
$("bHeal").addEventListener("click", () => mode === "raid" && heal());
$("bBag").addEventListener("click", () => mode === "raid" && openBag());
// a phone call or app switch mid-raid pauses on the bag screen instead of running on
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "raid") openBag();
});
renderStash();

function frame(now: number) {
  const dt = Math.min(0.05, (now - clock.last) / 1000);
  clock.last = now;
  if (mode === "raid") update(dt);
  draw(R);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
