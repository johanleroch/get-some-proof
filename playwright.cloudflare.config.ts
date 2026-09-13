import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./workers/delivery/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8790", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node scripts/cloudflare-fixture.mjs",
      url: "http://127.0.0.1:8790",
      reuseExistingServer: false,
    },
    {
      command:
        "node scripts/build-cloudflare-delivery.mjs && pnpm exec wrangler dev --config workers/delivery/wrangler.jsonc --port 8789 --var CLOUDFLARE_CANARY_PUBLISH_SECRET:synthetic-canary-browser-secret-32-characters",
      url: "http://127.0.0.1:8789/embed/loader.js",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
