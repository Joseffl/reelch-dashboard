import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  expect: { timeout: 20_000 },
  timeout: 45_000,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  reporter: "line",
});
