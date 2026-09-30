import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("member web serves a PWA manifest and service worker", async ({ page, request }) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/config/theme")) {
      await route.fulfill({
        json: {
          success: true,
          data: {
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
          },
          meta: { requestId: "e2e-pwa" },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: { notifications: 0, messages: 0 },
        meta: { requestId: "e2e-pwa" },
      },
    });
  });

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const body = (await manifest.json()) as { display: string; start_url: string };
  expect(body.display).toBe("standalone");
  expect(body.start_url).toBe("/");

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  const script = await worker.text();
  expect(script).toContain("hasut-shell-v1");
  expect(script).not.toContain('cache.addAll(["/api');

  await page.goto("/");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const ready = await navigator.serviceWorker.ready;
        return ready.active?.scriptURL.includes("/sw.js") === true;
      }),
    )
    .toBe(true);
});

test("iPhone visitors see a Home Screen hint they can dismiss", async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
  });
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: { notifications: 0, messages: 0 },
        meta: { requestId: "e2e-pwa" },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByLabel("Install HASUT")).toBeVisible();
  await expect(page.getByText("Add HASUT to your Home Screen from the Share menu.")).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByLabel("Install HASUT")).toHaveCount(0);
});
