import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: "list",
  projects: [
    {
      name: "fixture",
      testDir: "./tests/e2e",
      testMatch: /reddit-filter\.spec\.js/,
      fullyParallel: true,
      use: {
        trace: "on-first-retry"
      }
    },
    {
      name: "live",
      testDir: "./tests/live",
      timeout: 60000,
      fullyParallel: false,
      use: {
        trace: "on-first-retry"
      }
    }
  ]
});
