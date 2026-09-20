import { expect, test } from "@playwright/test";

test("staff sign in is branded HASUT and hides the console nav", async ({ page }) => {
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
  await expect(page.getByText("HASUT operations")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  await expect(page.getByLabel("Staff email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  // The console section map is not a thing an unauthenticated visitor should see.
  await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  // /auth/config is mocked to 401 here, so this also proves the form still
  // renders on contract defaults when config cannot be fetched.
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});
