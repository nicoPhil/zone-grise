import { STYLES } from "./goals";
import { playRaid } from "./play";

// npx vite-node -c sim/bots/vite.config.ts sim/bots/run.ts <zone> <raids per style>: one JSON line per raid on stdout
const zi = Number(process.argv[2] || 0),
  n = Number(process.argv[3] || 1);
for (let i = 0; i < n; i++) for (const s of STYLES) console.log(JSON.stringify(playRaid(zi, s)));
