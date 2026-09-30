import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

const HLS_ORIGIN = process.env.HASUT_E2E_HLS_ORIGIN ?? "http://127.0.0.1:18888";

function envelope(data: unknown): { success: true; data: unknown; meta: { requestId: string } } {
  return { success: true, data, meta: { requestId: "e2e-hls" } };
}

async function mockStories(page: Page, live: Record<string, unknown> | null): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/config/theme")) {
      await route.fulfill({
        json: envelope({
          version: 1,
          tokens: {
            primary: "#6D28D9",
            secondary: "#4C1D95",
            accent: "#EAB308",
            background: "#F8FAFC",
            surface: "#FFFFFF",
            text: "#0F172A",
            mutedText: "#64748B",
            textOnPrimary: "#FFFFFF",
            success: "#15803D",
            warning: "#C2410C",
            danger: "#DC2626",
            border: "#E2E8F0",
            radius: "12px",
            buttonRadius: "14px",
            cardRadius: "16px",
          },
          logoUrl: null,
        }),
      });
      return;
    }
    if (/\/stories\/[^/]+\/live/.test(url)) {
      await route.fulfill({ json: envelope({ live }) });
      return;
    }
    if (/\/stories\/[^/?#]+$/.test(url)) {
      await route.fulfill({ json: envelope([]) });
      return;
    }
    await route.fulfill({ json: envelope({ notifications: 0, messages: 0 }) });
  });
}

function liveSession(hlsUrl: string): Record<string, unknown> {
  return {
    id: "e2e-live",
    memberId: "owner-1",
    title: "Neighborhood walk",
    audience: "EVERYONE",
    status: "LIVE",
    hlsUrl,
    previewHlsUrl: hlsUrl,
    ingestUrl: null,
    startedAt: "2026-09-26T10:00:00.000Z",
    endedAt: null,
  };
}

test("MediaMTX-shaped origin serves an HLS playlist", async ({ request }) => {
  const ready = await request.get(`${HLS_ORIGIN}/live/e2e-ready/index.m3u8`);
  expect(ready.ok()).toBeTruthy();
  expect(await ready.text()).toContain("#EXTM3U");
  const pending = await request.get(`${HLS_ORIGIN}/live/e2e-missing/index.m3u8`);
  expect(pending.status()).toBe(404);
});

test("presence viewer waits when the HLS origin has no playlist yet", async ({ page }) => {
  await mockStories(page, liveSession(`${HLS_ORIGIN}/live/e2e-missing/index.m3u8`));
  await page.goto("/stories/owner-1", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Waiting for the live preview")).toBeVisible();
});

test("presence viewer leaves the live wait once the origin playlist is HLS", async ({ page }) => {
  await mockStories(page, liveSession(`${HLS_ORIGIN}/live/e2e-ready/index.m3u8`));
  await page.goto("/stories/owner-1", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Neighborhood walk")).toBeVisible();
  await expect(page.getByText("Waiting for the live preview")).toHaveCount(0);
  await expect(page.locator("video")).toBeVisible();
});

test("web origin proxies MediaMTX-shaped HLS when Next is started for e2e", async ({ request }) => {
  test.skip(
    Boolean(process.env.HASUT_E2E_SKIP_SERVER),
    "Reused Next may still rewrite /media/hls to :8888",
  );
  const proxied = await request.get("/media/hls/live/e2e-ready/index.m3u8");
  expect(proxied.ok()).toBeTruthy();
  expect(await proxied.text()).toContain("#EXTM3U");
});
