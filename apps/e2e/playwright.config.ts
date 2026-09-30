import { defineConfig } from "@playwright/test";

const skipServer = Boolean(process.env.HASUT_E2E_SKIP_SERVER);
const hlsOrigin = process.env.HASUT_E2E_HLS_ORIGIN ?? "http://127.0.0.1:18888";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: process.env.HASUT_E2E_BASE_URL ?? "http://127.0.0.1:3000",
  },
  webServer: [
    {
      command: "node hls-origin.mjs",
      cwd: ".",
      url: `${hlsOrigin}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
      env: {
        HASUT_E2E_HLS_PORT: new URL(hlsOrigin).port || "18888",
      },
    },
    ...(skipServer
      ? []
      : [
          {
            command: "pnpm --filter @hasut/web start",
            cwd: "../..",
            url: "http://127.0.0.1:3000",
            reuseExistingServer: true,
            timeout: 120_000,
            env: {
              LIVE_HLS_BASE_URL: hlsOrigin,
            },
          },
          {
            command: "pnpm --filter @hasut/admin start",
            cwd: "../..",
            url: "http://127.0.0.1:3002",
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]),
  ],
});
