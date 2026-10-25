import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// display modules the raid imports, swapped for stubs so raids run headless in node
const STUBS = ["render/canvas", "render/decor", "render/furniture", "input", "ui/hud", "ui/bag", "ui/end"];
const stubOf = (id: string) => STUBS.find((s) => id.endsWith(`/src/${s}.ts`));

const headless: Plugin = {
  name: "headless",
  enforce: "pre",
  async resolveId(source, importer, options) {
    const hit = await this.resolve(source, importer, { ...options, skipSelf: true });
    const s = hit && stubOf(hit.id);
    return s ? fileURLToPath(new URL(`stubs/${s.split("/").at(-1)}.ts`, import.meta.url)) : null;
  },
};

export default defineConfig({ plugins: [headless], define: { __BUILD__: JSON.stringify("bots") } });
