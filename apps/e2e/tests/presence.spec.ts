import { expect, test, type Page, type Route } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

const THEME = {
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
};

const COMPOSER = {
  captionMaxLength: 180,
  captionColors: ["#FFFFFF", "#0F172A"],
  maxVideoDurationSeconds: 60,
  maxAudioSegmentSeconds: 30,
  audioLibraryEnabled: true,
  patronCount: 1,
  maxActiveStories: 5,
  storyTtlHours: 24,
};

function envelope(data: unknown): { success: true; data: unknown; meta: { requestId: string } } {
  return { success: true, data, meta: { requestId: "e2e-presence" } };
}

function fail(code: string, message: string, status: number) {
  return {
    status,
    json: {
      success: false,
      error: { code, message },
      meta: { requestId: "e2e-presence" },
    },
  };
}

async function mockMemberApi(
  page: Page,
  handlers: (route: Route, url: string) => Promise<boolean>,
): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/config/theme")) {
      await route.fulfill({ json: envelope(THEME) });
      return;
    }
    if (await handlers(route, url)) {
      return;
    }
    await route.fulfill({
      json: envelope({ notifications: 0, messages: 0 }),
    });
  });
}

test("story composer shows loading then an empty library honestly", async ({ page }) => {
  let releaseComposer: (() => void) | undefined;
  const composerReady = new Promise<void>((resolve) => {
    releaseComposer = resolve;
  });
  await mockMemberApi(page, async (route, url) => {
    if (url.includes("/stories/composer")) {
      await composerReady;
      await route.fulfill({ json: envelope(COMPOSER) });
      return true;
    }
    if (url.includes("/stories/audio")) {
      await route.fulfill({ json: envelope([]) });
      return true;
    }
    return false;
  });
  await page.goto("/story");
  await expect(page.locator("[data-state=loading]")).toBeVisible();
  await expect(page.getByText("Loading the composer…")).toBeVisible();
  releaseComposer?.();
  await expect(page.locator("[data-state=success]")).toBeVisible();
  await expect(
    page.getByText("No playable HASUT tracks yet. You can still add your own audio."),
  ).toBeVisible();
});

test("story composer is empty when the member is signed out", async ({ page }) => {
  await mockMemberApi(page, async (route, url) => {
    if (url.includes("/stories/composer")) {
      await route.fulfill(fail("UNAUTHENTICATED", "Sign in required", 401));
      return true;
    }
    return false;
  });
  await page.goto("/story");
  await expect(page.locator("[data-state=empty]")).toBeVisible();
  await expect(page.getByText("Sign in to add a presence.")).toBeVisible();
});

test("presence viewer shows loading while stories are fetched", async ({ page }) => {
  await mockMemberApi(page, async (route, url) => {
    if (/\/stories\/[^/]+\/live/.test(url) || /\/stories\/[^/?#]+$/.test(url)) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1_200);
      });
      if (/\/live/.test(url)) {
        await route.fulfill({ json: envelope({ live: null }) });
      } else {
        await route.fulfill({ json: envelope([]) });
      }
      return true;
    }
    return false;
  });
  await page.goto("/stories/11111111-1111-4111-8111-111111111111", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText("Loading presence…")).toBeVisible();
  await expect(page.locator("[data-state=empty]")).toBeVisible();
});

test("presence viewer is empty when there is no story or live", async ({ page }) => {
  await mockMemberApi(page, async (route, url) => {
    if (/\/stories\/[^/]+\/live/.test(url)) {
      await route.fulfill({ json: envelope({ live: null }) });
      return true;
    }
    if (/\/stories\/[^/]+$/.test(url)) {
      await route.fulfill({ json: envelope([]) });
      return true;
    }
    return false;
  });
  await page.goto("/stories/11111111-1111-4111-8111-111111111111");
  await expect(page.locator("[data-state=empty]")).toBeVisible();
  await expect(
    page.getByText("No active story. The map pin still shows their profile."),
  ).toBeVisible();
});

test("presence viewer waits until a live playlist exists", async ({ page }) => {
  await page.route("**/media/hls/**", async (route) => {
    await route.fulfill({ status: 404, body: "not ready" });
  });
  await mockMemberApi(page, async (route, url) => {
    if (/\/stories\/[^/]+\/live/.test(url)) {
      await route.fulfill({
        json: envelope({
          live: {
            id: "live-1",
            memberId: "owner-1",
            title: "Neighborhood walk",
            audience: "EVERYONE",
            status: "LIVE",
            hlsUrl: "/media/hls/live/live-1/index.m3u8",
            previewHlsUrl: "/media/hls/live/live-1/index.m3u8",
            ingestUrl: null,
            startedAt: "2026-09-26T10:00:00.000Z",
            endedAt: null,
          },
        }),
      });
      return true;
    }
    if (/\/stories\/[^/]+$/.test(url)) {
      await route.fulfill({ json: envelope([]) });
      return true;
    }
    return false;
  });
  await page.goto("/stories/owner-1");
  await expect(page.getByText("Waiting for the live preview")).toBeVisible();
});

test("presence viewer hides a Patrons story from a stranger", async ({ page }) => {
  await mockMemberApi(page, async (route, url) => {
    if (/\/stories\/[^/]+\/live/.test(url)) {
      await route.fulfill({ json: envelope({ live: null }) });
      return true;
    }
    if (/\/stories\/[^/]+$/.test(url)) {
      await route.fulfill({ json: envelope([]) });
      return true;
    }
    return false;
  });
  await page.goto("/stories/owner-1");
  await expect(
    page.getByText("No active story. The map pin still shows their profile."),
  ).toBeVisible();
  await expect(page.getByText("Patrons only")).toHaveCount(0);
});

test("presence viewer shows a Patrons story to a Patron", async ({ page }) => {
  await mockMemberApi(page, async (route, url) => {
    if (/\/stories\/[^/]+\/live/.test(url)) {
      await route.fulfill({ json: envelope({ live: null }) });
      return true;
    }
    if (/\/stories\/[^/]+$/.test(url)) {
      await route.fulfill({
        json: envelope([
          {
            id: "story-1",
            memberId: "owner-1",
            kind: "IMAGE",
            imageUrl: "https://cdn.example/still.jpg",
            hlsUrl: null,
            previewHlsUrl: null,
            audioUrl: null,
            audio: {
              source: "NONE",
              trackId: null,
              title: null,
              url: null,
              startSeconds: 0,
              endSeconds: null,
            },
            caption: "Patrons only",
            captionColor: "#FFFFFF",
            captionX: null,
            captionY: null,
            captionW: null,
            trimStartSeconds: 0,
            trimEndSeconds: null,
            originalAudioMode: "KEEP",
            audience: "PATRONS",
            playbackStatus: "READY",
            expiresAt: "2026-09-27T10:00:00.000Z",
            moderationStatus: "ACTIVE",
            createdAt: "2026-09-26T10:00:00.000Z",
          },
        ]),
      });
      return true;
    }
    return false;
  });
  await page.goto("/stories/owner-1");
  await expect(page.locator("[data-state=success]")).toBeVisible();
  await expect(page.getByText("Patrons only")).toBeVisible();
});
