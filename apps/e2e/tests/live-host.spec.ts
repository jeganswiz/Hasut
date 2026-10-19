import { expect, test, type Page } from "@playwright/test";
import { envelope, THEME } from "./e2e-fixtures";

const COMPOSER = {
  titleMaxLength: 80,
  descriptionMaxLength: 500,
  categories: ["Workshop"],
  heartbeatSeconds: 20,
  chatMaxChars: 300,
  maxInvitees: 50,
  maxModerators: 10,
  maxScheduleDaysAhead: 30,
  recordingAvailable: false,
  replayRetentionDays: 30,
  patronCount: 0,
  playlistPollSeconds: 2,
};

const LIVE = {
  id: "e2e-host-live",
  memberId: "host-1",
  host: { id: "host-1", displayName: "Ada", photoUrl: null },
  title: "Shop floor",
  description: "",
  category: "Workshop",
  thumbnailUrl: null,
  audience: "EVERYONE",
  status: "LIVE",
  scheduledFor: null,
  hlsUrl: "/media/hls/live/e2e-host-live/index.m3u8",
  previewHlsUrl: "/media/hls/live/e2e-host-live/index.m3u8",
  ingestUrl: null,
  chatEnabled: true,
  chatPatronsOnly: false,
  slowModeSeconds: 0,
  blockedWords: [],
  recordingEnabled: false,
  recordingStatus: "NONE",
  replayStoryId: null,
  viewerCount: 1,
  peakViewers: 1,
  totalViews: 1,
  reactionCount: 0,
  messageCount: 0,
  endedReason: null,
  startedAt: "2026-10-12T10:00:00.000Z",
  endedAt: null,
};

async function mockHost(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/config/theme")) {
      await route.fulfill({ json: envelope(THEME) });
      return;
    }
    if (url.includes("/stories/composer")) {
      await route.fulfill({
        json: envelope({
          captionMaxLength: 180,
          captionColors: ["#FFFFFF"],
          maxVideoDurationSeconds: 60,
          maxAudioSegmentSeconds: 30,
          audioLibraryEnabled: false,
          patronCount: 0,
          maxActiveStories: 5,
          storyTtlHours: 24,
        }),
      });
      return;
    }
    if (url.includes("/live/composer")) {
      await route.fulfill({ json: envelope(COMPOSER) });
      return;
    }
    if (url.includes("/connections")) {
      await route.fulfill({ json: envelope([]) });
      return;
    }
    if (url.endsWith("/me/live") && method === "GET") {
      await route.fulfill({ json: envelope({ live: null }) });
      return;
    }
    if (url.endsWith("/me/live") && method === "POST") {
      await route.fulfill({ json: envelope(LIVE) });
      return;
    }
    if (url.includes("/me/live/end")) {
      await route.fulfill({
        json: envelope({
          ...LIVE,
          status: "ENDED",
          endedAt: "2026-10-12T10:10:00.000Z",
          endedReason: "HOST",
        }),
      });
      return;
    }
    if (url.includes("/me/live/") && url.includes("/summary")) {
      await route.fulfill({
        json: envelope({
          live: { ...LIVE, status: "ENDED", endedReason: "HOST" },
          durationSeconds: 600,
          peakViewers: 4,
          totalViews: 6,
          reactionCount: 2,
          messageCount: 3,
          endedReason: "HOST",
        }),
      });
      return;
    }
    await route.fulfill({ json: envelope({ notifications: 0, messages: 0 }) });
  });
}

test("host studio walks setup, live, confirm end, and summary", async ({ page }) => {
  await mockHost(page);
  await page.goto("/story", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Live" }).click();
  await expect(page.getByText("Preview your camera")).toBeVisible();
  await page.getByLabel("Live title").fill("Shop floor");
  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByRole("button", { name: "End Live" })).toBeVisible();
  await page.getByRole("button", { name: "End Live" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "End live" }).click();
  await expect(page.getByText("Live summary")).toBeVisible();
  await expect(page.getByText("Peak viewers 4")).toBeVisible();
});
