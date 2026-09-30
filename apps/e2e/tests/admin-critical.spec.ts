import { expect, test } from "@playwright/test";
import {
  AUTH_CONFIG,
  THEME,
  envelope,
  member,
  otpReceipt,
  session,
  waitForAuthConfig,
} from "./e2e-fixtures";

const REQUEST = {
  id: "77777777-7777-4777-8777-777777777777",
  type: "IDENTITY" as const,
  status: "PENDING" as const,
  documentMediaIds: ["88888888-8888-4888-8888-888888888888"],
  reviewNote: null,
  createdAt: "2026-09-26T09:00:00.000Z",
  decidedAt: null,
  member: { id: "99999999-9999-4999-8999-999999999999", displayName: "Kabir Shah", photoUrl: null },
};

test("staff sign-in searches a member, approves identity, and sees the audit row", async ({
  page,
}) => {
  let approved = false;

  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/config/theme")) {
      await route.fulfill({ json: envelope(THEME) });
      return;
    }
    if (url.includes("/auth/config")) {
      await route.fulfill({ json: envelope(AUTH_CONFIG) });
      return;
    }
    if (url.includes("/auth/password/login")) {
      await route.fulfill({
        json: envelope({ status: "TWO_FACTOR_REQUIRED", challenge: otpReceipt() }),
      });
      return;
    }
    if (url.includes("/auth/two-factor/verify")) {
      await route.fulfill({ json: envelope(session(["ADMIN", "MEMBER"])) });
      return;
    }
    if (url.includes("/api/v1/me")) {
      await route.fulfill({ json: envelope(member(["ADMIN", "MEMBER"])) });
      return;
    }
    if (url.includes("/admin/members") && method === "GET") {
      await route.fulfill({
        json: envelope([
          {
            id: REQUEST.member.id,
            displayName: "Kabir Shah",
            status: "ACTIVE",
            roles: ["MEMBER"],
            createdAt: "2026-09-01T00:00:00.000Z",
          },
        ]),
      });
      return;
    }
    if (url.includes("/admin/verification") && url.includes("/decide")) {
      approved = true;
      await route.fulfill({
        json: envelope({
          ...REQUEST,
          status: "VERIFIED",
          reviewNote: "Identity documents match",
          decidedAt: "2026-09-26T11:00:00.000Z",
        }),
      });
      return;
    }
    if (url.includes("/admin/verification")) {
      await route.fulfill({ json: envelope(approved ? [] : [REQUEST]) });
      return;
    }
    if (url.includes("/admin/ops/summary")) {
      await route.fulfill({
        json: envelope({
          pendingVerifications: approved ? 0 : 1,
          openReports: 0,
          openTickets: 0,
          suspendedMembers: 0,
        }),
      });
      return;
    }
    if (url.includes("/admin/audit")) {
      await route.fulfill({
        json: envelope(
          approved
            ? [
                {
                  id: "audit-1",
                  actorId: member(["ADMIN"]).id,
                  action: "VERIFICATION_APPROVED",
                  entity: "verification_request",
                  entityId: REQUEST.id,
                  requestId: "e2e-critical",
                  createdAt: "2026-09-26T11:00:00.000Z",
                },
              ]
            : [],
        ),
      });
      return;
    }
    await route.fulfill({ json: envelope({ notifications: 0, messages: 0 }) });
  });

  const authConfig = waitForAuthConfig(page);
  await page.goto("http://127.0.0.1:3002/login", { waitUntil: "domcontentloaded" });
  await authConfig;
  await page.getByLabel("Staff email").fill("admin@hasut.local");
  await page.getByLabel("Password", { exact: true }).fill("Chennai-Patron-42");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Development code:")).toBeVisible();
  await page.getByLabel("Staff verification code digit 1").fill("123456");
  await expect(page.getByRole("heading", { name: "HASUT Admin" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Members" })
    .click();
  await expect(page.getByRole("heading", { name: "Members", level: 1 })).toBeVisible();
  await page.locator("main").getByLabel("Search members").fill("Kabir");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Kabir Shah")).toBeVisible();
  await expect(page.getByRole("table")).not.toContainText(/7010|\+91/);
  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Verification" })
    .click();
  await expect(
    page.getByText("Approve identity only. This is not skill verification."),
  ).toBeVisible();
  await page.getByLabel("Review note").fill("Identity documents match");
  await page.getByRole("button", { name: "Approve identity" }).click();
  await expect(page.getByText("No pending identity verification requests.")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Audit" })
    .click();
  await expect(page.getByText("VERIFICATION_APPROVED")).toBeVisible();
});
