import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4180",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 12"], browserName: "chromium" },
      testIgnore: /m06-(quality|a11y|cross-browser)\.spec\.ts/,
    },
    {
      name: "m06-chromium",
      testMatch: /m06-(quality|a11y)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
    {
      name: "m06-firefox",
      testMatch: /m06-cross-browser\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], browserName: "firefox" },
    },
    {
      name: "m06-webkit",
      testMatch: /m06-cross-browser\.spec\.ts/,
      use: { ...devices["Desktop Safari"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4180",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
