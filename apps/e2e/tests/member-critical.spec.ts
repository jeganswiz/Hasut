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

test.use({ viewport: { width: 390, height: 844 } });

const PEER = {
  id: "22222222-2222-4222-8222-222222222222",
  displayName: "Priya Nair",
  photoUrl: null,
};
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

test("member OTP sign-in reaches connections and chat", async ({ page }) => {
  let accepted = false;
  const pending = {
    id: "44444444-4444-4444-8444-444444444444",
    status: "PENDING" as const,
    direction: "INCOMING" as const,
    peer: PEER,
    conversationId: null,
    createdAt: "2026-09-26T10:00:00.000Z",
    updatedAt: "2026-09-26T10:00:00.000Z",
  };
  const connected = {
    ...pending,
    status: "ACCEPTED" as const,
    conversationId: CONVERSATION_ID,
  };
  const outgoing = {
    id: "55555555-5555-4555-8555-555555555555",
    conversationId: CONVERSATION_ID,
    senderId: member().id,
    type: "TEXT" as const,
    body: "See you near the market.",
    mediaUrl: null,
    createdAt: "2026-09-26T10:05:00.000Z",
    readAt: null,
  };

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
    if (url.includes("/auth/otp/request")) {
      await route.fulfill({ json: envelope(otpReceipt()) });
      return;
    }
    if (url.includes("/auth/otp/verify")) {
      await route.fulfill({ json: envelope(session()) });
      return;
    }
    if (url.endsWith("/api/v1/me") || url.includes("/api/v1/me?")) {
      await route.fulfill({ json: envelope(member()) });
      return;
    }
    if (url.includes("/connections") && method === "POST" && url.includes("/accept")) {
      accepted = true;
      await route.fulfill({ json: envelope(connected) });
      return;
    }
    if (url.includes("/connections") && method === "GET") {
      await route.fulfill({ json: envelope(accepted ? [connected] : [pending]) });
      return;
    }
    if (url.includes(`/conversations/${CONVERSATION_ID}/read`)) {
      await route.fulfill({ json: envelope({ updated: 1 }) });
      return;
    }
    if (url.includes(`/conversations/${CONVERSATION_ID}/messages`) && method === "POST") {
      await route.fulfill({ json: envelope(outgoing) });
      return;
    }
    if (url.includes(`/conversations/${CONVERSATION_ID}/messages`)) {
      await route.fulfill({
        json: envelope({
          items: [
            {
              id: "66666666-6666-4666-8666-666666666666",
              conversationId: CONVERSATION_ID,
              senderId: PEER.id,
              type: "TEXT",
              body: "I can take the leak visit tomorrow morning.",
              mediaUrl: null,
              createdAt: "2026-09-26T10:04:00.000Z",
              readAt: "2026-09-26T10:04:30.000Z",
            },
          ],
          nextCursor: null,
        }),
      });
      return;
    }
    if (url.includes(`/conversations/${CONVERSATION_ID}`)) {
      await route.fulfill({
        json: envelope({
          id: CONVERSATION_ID,
          peer: PEER,
          lastMessage: null,
          unreadCount: 0,
          updatedAt: "2026-09-26T10:04:00.000Z",
        }),
      });
      return;
    }
    await route.fulfill({ json: envelope({ notifications: 0, messages: 0 }) });
  });

  const authConfig = waitForAuthConfig(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await authConfig;
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("tab", { name: "One-time code" }).click();
  await expect(page.getByRole("tab", { name: "One-time code" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByLabel("Phone or email").fill("7010358490");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("Development code:")).toBeVisible();
  await page.getByLabel("Verification code digit 1").fill("123456");
  await expect(page).toHaveURL(/\/connections/);
  await expect(page.getByText("Priya Nair")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("link", { name: "Open chat" }).click();
  await expect(page.getByText("I can take the leak visit tomorrow morning.")).toBeVisible();
  await page.getByPlaceholder("Message").fill("See you near the market.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("See you near the market.")).toBeVisible();
});
