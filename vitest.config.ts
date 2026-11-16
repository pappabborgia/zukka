import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./apps/web/src/", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test-stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/unit/**/*.test.ts"],
    env: { SESSION_SECRET: "test-secret-test-secret-test-secret-123" },
  },
});
