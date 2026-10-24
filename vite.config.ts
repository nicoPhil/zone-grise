import { defineConfig } from "vitest/config";

export default defineConfig({
  // served as a project site at nicophil.github.io/zone-grise/
  base: "/zone-grise/",
  test: { environment: "node" },
});
