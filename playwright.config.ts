import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", fullyParallel: false, workers: 1, timeout: 60000,
  reporter: "list",
  use: { baseURL: process.env.BOOKING_TEST_URL || "http://localhost:3000", headless: true, channel: "chrome", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev", url: process.env.BOOKING_TEST_URL || "http://localhost:3000/booking", reuseExistingServer: true, timeout: 60000 },
});
