import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", fullyParallel: false, workers: 1, timeout: 60000,
  reporter: "list",
  use: { baseURL: process.env.BOOKING_TEST_URL || "http://localhost:3000", headless: true, channel: "chrome", screenshot: "only-on-failure", trace: "retain-on-failure" },
  // Exercise the production build so browser tests do not depend on development
  // font downloads or hot-reload internals.
  webServer: { command: "npm run start", url: process.env.BOOKING_TEST_URL || "http://localhost:3000/booking", reuseExistingServer: true, timeout: 60000 },
});
