import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const localChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync(localChrome) ? localChrome : undefined),
    },
  },
  webServer: {
    command: "pnpm exec tsx scripts/e2e-server.ts",
    url: "http://127.0.0.1:3100/signin",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
