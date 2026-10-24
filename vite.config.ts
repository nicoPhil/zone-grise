import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";

const sha = (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString()).trim().slice(0, 7);
const when = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default defineConfig({
  // served as a project site at nicophil.github.io/zone-grise/
  base: "/zone-grise/",
  define: { __BUILD__: JSON.stringify(`${sha} · ${when}`) },
  test: { environment: "node" },
});
