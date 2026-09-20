import { defineConfig } from "@playwright/test";

const skipServer = Boolean(process.env.HASUT_E2E_SKIP_SERVER);

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: process.env.HASUT_E2E_BASE_URL ?? "http://127.0.0.1:3000",
  },
  webServer: skipServer
    ? undefined
    : [
        {
          command: "pnpm --filter @hasut/web start",
          cwd: "../..",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: "pnpm --filter @hasut/admin start",
          cwd: "../..",
          url: "http://127.0.0.1:3002",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
