import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Tests that need the Firebase emulators. Run with `npm run test:emu`. */
export default defineConfig({
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./apps/web/src/", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test-stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["apps/**/test/emu/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: { FIREBASE_PROJECT_ID: "demo-zukka", SESSION_SECRET: "test-secret-test-secret-test-secret-123" },
  },
});
