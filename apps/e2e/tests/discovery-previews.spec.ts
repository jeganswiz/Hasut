import { expect, test } from "@playwright/test";
import { THEME, envelope } from "./e2e-fixtures";

test.use({ viewport: { width: 390, height: 844 } });

test("cellular data saver shows an explicit Play previews control", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: true, type: "cellular", effectiveType: "3g" }),
    });
  });
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/config/theme")) {
      await route.fulfill({ json: envelope(THEME) });
      return;
    }
    await route.fulfill({
      json: envelope({ notifications: 0, messages: 0 }),
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const chip = page.getByRole("button", { name: "Play previews" });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});
