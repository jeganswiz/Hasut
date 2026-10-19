import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

function stubApi(page: import("@playwright/test").Page, delayProfileMs = 0) {
  return page.route("**/api/v1/**", async (route) => {
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
          meta: { requestId: "e2e-theme" },
        },
      });
      return;
    }
    if (url.includes("/me/profile")) {
      if (delayProfileMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayProfileMs));
      }
      await route.fulfill({
        status: 401,
        json: {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Sign in" },
          meta: { requestId: "e2e-guest" },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: { notifications: 0, messages: 0 },
        meta: { requestId: "e2e" },
      },
    });
  });
}

test("member map chrome shows HASUT and native tabs", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await expect(page.getByText("HASUT").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Member" })).toBeVisible();
});

test("unknown session reserves six tab slots before guest chrome settles", async ({ page }) => {
  await stubApi(page, 1500);
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Member" }).last();
  await expect(tabs.locator("[data-nav-slot]")).toHaveCount(6);
  await expect(tabs.locator("[data-nav-slot='shown']")).toHaveCount(1, { timeout: 8000 });
});

test("tab clicks keep the same chrome instance", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Member" }).last();
  await expect(tabs.locator("[data-nav-slot='shown']")).toHaveCount(1);
  const chrome = page.locator(".app-chrome").first();
  await chrome.evaluate((node) => {
    node.setAttribute("data-shell", "persistent");
  });
  await tabs.getByRole("link", { name: "Map" }).click();
  await expect(page.locator(".app-chrome[data-shell='persistent']")).toBeVisible();
});

test("map results sheet is visible without scrolling the window through the map", async ({
  page,
}) => {
  await stubApi(page);
  await page.goto("/");
  const sheet = page.locator("[data-results-sheet]");
  await expect(sheet).toBeVisible();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBe(0);
});

test("home and story do not bleed horizontally", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  const homeOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(homeOverflow).toBe(false);
  await page.goto("/story");
  const storyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(storyOverflow).toBe(false);
});
