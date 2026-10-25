import { def, nameOf, valOf, type Item } from "./items";
import { qInfo } from "./progression";
import { stars } from "./rolls";
import { S, type RaidLog } from "./state";
import { RINGS } from "./world/rings";
import { ZONES, power } from "./zones";

function piece([slot, it]: [string, Item | null]) {
  if (!it) return null;
  const fx = Object.entries(it.fx || {}).map(([k, v]) => `${k} ${v}`);
  const roll = it.q === undefined ? "" : ` ${stars(it)}★ q${it.q}${fx.length ? ` (${fx.join(", ")})` : ""}`;
  return `- ${slot} : ${nameOf(it)} [r${def(it.k).r}]${roll}`;
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

const raidLine = (l: RaidLog) =>
  [
    l.n,
    ZONES[l.z]?.name ?? l.z,
    l.ok ? "sorti" : "mort",
    mmss(l.t),
    l.val,
    l.kills,
    l.boss,
    l.vaults,
    l.violet,
    RINGS[l.deep]?.n ?? l.deep,
    l.dmg,
    l.hp,
    l.pw,
    l.cr,
    l.sv,
    l.core ?? "",
    l.ttk ?? "",
  ].join(";");

/** The whole save as plain text, to paste into a chat and have the game's balance analysed. */
export function report(build: string, now = new Date()): string {
  const { st, sta, up } = S;
  const stash = S.stash.reduce((s, i) => s + valOf(i), 0);
  return [
    `Zone Grise · ${now.toISOString().slice(0, 16).replace("T", " ")} · version ${build}`,
    `Raids ${st.raids} · extractions ${st.ext} · morts ${st.dead} · meilleur butin ${st.best} cr`,
    `Crédits ${S.credits} · coffre ${S.stash.length} objets (${stash} cr) · puissance ${power()}`,
    `Zones ouvertes jusqu'à ${ZONES[S.opened].name} · extractions par zone ${S.zx.join("/")}`,
    `Stations : établi ${sta.bench}, poche ${sta.pocket}, comptoir ${sta.trade} · améliorations : sac ${up.bag}, soins ${up.meds}, PV ${up.hp}`,
    "Équipé :",
    ...Object.entries(S.lo.eq)
      .map(piece)
      .filter((x) => x !== null),
    `- soins ${S.lo.meds}, clés ${S.lo.keys}`,
    "Contrats :",
    ...S.q.map((q) => `- ${q.t}${q.k ? " " + q.k : ""} ${q.have}/${q.n} · ${q.cr} cr${qInfo(q).done ? " · fait" : ""}`),
    `Derniers raids (${S.log.length}) :`,
    "n;zone;issue;durée;butin;kills;brute;salles;militaires;anneau max;PV perdus;PV fin;puissance;crédits;valeur coffre;s au Cœur;s pour tuer",
    ...S.log.map(raidLine),
  ].join("\n");
}
