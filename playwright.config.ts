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
    baseURL: "http://localhost:3000",
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
    command: "pnpm dev",
    url: "http://localhost:3000/signin",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
