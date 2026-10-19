import { expect, test, type Page } from "@playwright/test";
import { envelope, THEME } from "./e2e-fixtures";

const HLS_ORIGIN = process.env.HASUT_E2E_HLS_ORIGIN ?? "http://127.0.0.1:18888";

function liveSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "e2e-live",
    memberId: "owner-1",
    host: { id: "owner-1", displayName: "Ada", photoUrl: null },
    title: "Neighborhood walk",
    description: "",
    category: null,
    thumbnailUrl: null,
    audience: "EVERYONE",
    status: "LIVE",
    scheduledFor: null,
    hlsUrl: `${HLS_ORIGIN}/live/e2e-ready/index.m3u8`,
    previewHlsUrl: `${HLS_ORIGIN}/live/e2e-ready/index.m3u8`,
    ingestUrl: null,
    chatEnabled: true,
    chatPatronsOnly: false,
    slowModeSeconds: 0,
    blockedWords: [],
    recordingEnabled: false,
    recordingStatus: "NONE",
    replayStoryId: null,
    viewerCount: 3,
    peakViewers: 3,
    totalViews: 3,
    reactionCount: 0,
    messageCount: 0,
    endedReason: null,
    startedAt: "2026-10-12T10:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

async function mockViewer(page: Page, live: Record<string, unknown> | "restricted"): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/config/theme")) {
      await route.fulfill({ json: envelope(THEME) });
      return;
    }
    if (url.includes("/live/discover")) {
      await route.fulfill({
        json: envelope({
          liveNow: [],
          patrons: [],
          upcoming: [],
          recommended: [],
          recentReplays: [],
        }),
      });
      return;
    }
    if (/\/live\/[^/]+$/.test(url) && !url.includes("/chat") && !url.includes("/metrics")) {
      if (live === "restricted") {
        await route.fulfill({
          status: 404,
          json: {
            success: false,
            error: { code: "NOT_FOUND", message: "Not found" },
            meta: { requestId: "e2e-live" },
          },
        });
        return;
      }
      await route.fulfill({ json: envelope(live) });
      return;
    }
    if (url.includes("/chat")) {
      await route.fulfill({ json: envelope({ messages: [], nextCursor: null, pinned: null }) });
      return;
    }
    await route.fulfill({ json: envelope({ notifications: 0, messages: 0 }) });
  });
}

test("viewer waits when the playlist is missing", async ({ page }) => {
  await mockViewer(
    page,
    liveSession({
      hlsUrl: `${HLS_ORIGIN}/live/e2e-missing/index.m3u8`,
      previewHlsUrl: `${HLS_ORIGIN}/live/e2e-missing/index.m3u8`,
    }),
  );
  await page.goto("/live/e2e-live", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Waiting for the live preview")).toBeVisible();
});

test("viewer plays when the origin playlist is HLS", async ({ page }) => {
  await mockViewer(page, liveSession());
  await page.goto("/live/e2e-live", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Neighborhood walk")).toBeVisible();
  await expect(page.getByText("Waiting for the live preview")).toHaveCount(0);
  await expect(page.locator("video")).toBeVisible();
});

test("viewer shows restricted copy when the live is private", async ({ page }) => {
  await mockViewer(page, "restricted");
  await page.goto("/live/e2e-private", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("This live is private")).toBeVisible();
});

test("viewer shows ended copy when the session is over", async ({ page }) => {
  await mockViewer(
    page,
    liveSession({
      status: "ENDED",
      endedAt: "2026-10-12T10:20:00.000Z",
      endedReason: "HOST",
      hlsUrl: null,
      previewHlsUrl: null,
    }),
  );
  await page.goto("/live/e2e-live", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("This live has ended.")).toBeVisible();
});
