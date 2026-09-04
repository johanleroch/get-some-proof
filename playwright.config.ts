import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "desktop-firefox",
      testIgnore: /visual-evidence\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "desktop-webkit",
      testIgnore: /visual-evidence\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    {
      name: "mobile-webkit",
      testIgnore: /visual-evidence\.spec\.ts/,
      use: { ...devices["iPhone 15"] },
    },
  ],
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    env: {
      VISUAL_EVIDENCE_FIXTURES: "true",
      VISUAL_EVIDENCE_MODE: "true",
    },
    url: `${baseURL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
