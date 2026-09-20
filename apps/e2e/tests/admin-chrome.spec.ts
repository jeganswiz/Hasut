import { expect, test } from "@playwright/test";

test("admin chrome shows HASUT sidebar branding", async ({ page }) => {
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
          meta: { requestId: "e2e-theme" },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Sign in required" },
        meta: { requestId: "e2e" },
      },
      status: 401,
    });
  });
  await page.goto("http://127.0.0.1:3002/login");
  await expect(page.getByText("HASUT").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
});
