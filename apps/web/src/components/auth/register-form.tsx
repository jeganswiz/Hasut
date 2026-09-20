"use client";

import { Button, PasswordField, TextField, cssVar } from "@hasut/ui";
import { isEmail } from "@hasut/utils";
import Link from "next/link";
import { useState } from "react";
import { createWebApiClient } from "../../lib/api";
import { captchaToken } from "../../lib/captcha";
import { failure, loading, success, IDLE, type AuthFeedback } from "../../lib/auth-flow";
import { webTokenStorage } from "../../lib/token-storage";
import { AuthFeedbackNote } from "./auth-feedback";
import { SsoBlock } from "./sso-block";
import { useAuthConfig } from "./use-auth-config";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const { config } = useAuthConfig();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);

  const busy = feedback.status === "loading";
  const minLength = config?.passwordMinLength ?? 10;

  async function submit(): Promise<void> {
    if (displayName.trim().length === 0) {
      setFeedback({ status: "error", message: "Tell us what to call you." });
      return;
    }
    if (!isEmail(email)) {
      setFeedback({ status: "error", message: "Enter a valid email address." });
      return;
    }
    if (password.length < minLength) {
      setFeedback({ status: "error", message: `Use at least ${minLength} characters.` });
      return;
    }

    setFeedback(loading("Creating your account…"));
    try {
      const result = await createWebApiClient().register({
        email,
        password,
        displayName: displayName.trim(),
        phone: phone.trim().length > 0 ? phone.trim() : undefined,
        captchaToken: await captchaToken(config, "password_register"),
      });
      await webTokenStorage.setSession(result.tokens);
      setFeedback(success("Account created. Taking you in…"));
      window.location.assign(nextPath);
    } catch (error) {
      setFeedback(failure(error, "Unable to create your account."));
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form
        style={{ display: "grid", gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
          placeholder="Jegan M"
          autoComplete="name"
          disabled={busy}
          autoFocus
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          disabled={busy}
        />
        <TextField
          label="Phone (optional)"
          value={phone}
          onChange={setPhone}
          placeholder="7010358490"
          autoComplete="tel"
          inputMode="tel"
          disabled={busy}
          hint="Adds a recovery channel and lets you turn on two-step verification. Never shown publicly."
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          label="Password"
          autoComplete="new-password"
          disabled={busy}
          showStrength
          minLength={minLength}
        />
        <AuthFeedbackNote feedback={feedback} />
        <Button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <SsoBlock
        config={config}
        disabled={busy}
        onFeedback={setFeedback}
        onSignedIn={(result) => {
          void (async () => {
            await webTokenStorage.setSession(result.tokens);
            window.location.assign(nextPath);
          })();
        }}
      />

      <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: cssVar("primary") }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
