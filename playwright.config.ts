import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against production builds of both apps:
 *   web  -> http://localhost:3000   (main site)
 *   play -> http://127.0.0.1:3001   (games origin; a different site from localhost)
 * Run `npm run build` first.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
// E2E_BASE_URL runs the School Cup tests against a deployed site instead (the sandbox tests need the local servers).
const remote = process.env.E2E_BASE_URL;
const proxy = process.env.E2E_PROXY ? { server: process.env.E2E_PROXY } : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: remote ?? "http://localhost:3000",
    proxy,
    trace: "off",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: remote ? [] : [
    {
      command: "npm run start -w play",
      url: "http://127.0.0.1:3001/",
      env: { MAIN_ORIGINS: "http://localhost:3000" },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run start -w web",
      url: "http://localhost:3000/",
      env: { NEXT_PUBLIC_PLAY_ORIGIN: "http://127.0.0.1:3001" },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
