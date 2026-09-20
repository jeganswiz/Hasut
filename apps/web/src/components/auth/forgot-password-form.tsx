"use client";

import type { OtpChallengeReceipt } from "@hasut/types";
import { Button, OtpInput, PasswordField, TextField, cssVar } from "@hasut/ui";
import { isEmail } from "@hasut/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../../lib/api";
import { captchaToken } from "../../lib/captcha";
import {
  cooldownSeconds,
  failure,
  loading,
  success,
  IDLE,
  type AuthFeedback,
} from "../../lib/auth-flow";
import { AuthFeedbackNote } from "./auth-feedback";
import { useAuthConfig } from "./use-auth-config";

type Step = "identify" | "verify" | "reset" | "done";

export function ForgotPasswordForm() {
  const { config } = useAuthConfig();
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<OtpChallengeReceipt | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);

  const busy = feedback.status === "loading";
  const minLength = config?.passwordMinLength ?? 10;

  useEffect(() => {
    if (challenge === null) {
      return;
    }
    const tick = () => setCooldown(cooldownSeconds(challenge.resendAvailableAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  function destination(): { phone?: string; email?: string } {
    const value = identifier.trim();
    return isEmail(value) ? { email: value } : { phone: value };
  }

  async function sendCode(): Promise<void> {
    if (identifier.trim().length === 0) {
      setFeedback({ status: "error", message: "Enter your phone number or email." });
      return;
    }
    setFeedback(loading("Sending your reset code…"));
    try {
      const receipt = await createWebApiClient().forgotPassword({
        ...destination(),
        captchaToken: await captchaToken(config, "password_forgot"),
      });
      setChallenge(receipt);
      setCode("");
      setStep("verify");
      // Deliberately identical wording whether or not the account exists.
      setFeedback(
        success(`If that account exists, a code is on its way to ${receipt.destinationHint}.`),
      );
    } catch (error) {
      setFeedback(failure(error, "Unable to send a reset code."));
    }
  }

  async function verifyCode(entered: string): Promise<void> {
    if (challenge === null) {
      return;
    }
    setFeedback(loading("Checking your code…"));
    try {
      const result = await createWebApiClient().verifyPasswordReset({
        challengeId: challenge.challengeId,
        code: entered,
      });
      setTicket(result.ticket);
      setStep("reset");
      setFeedback(success("Code confirmed. Choose a new password."));
    } catch (error) {
      setCode("");
      setFeedback(failure(error, "Unable to verify that code."));
    }
  }

  async function submitPassword(): Promise<void> {
    if (ticket === null) {
      return;
    }
    if (password.length < minLength) {
      setFeedback({ status: "error", message: `Use at least ${minLength} characters.` });
      return;
    }
    setFeedback(loading("Saving your new password…"));
    try {
      const result = await createWebApiClient().resetPassword({ ticket, password });
      setStep("done");
      setFeedback(
        success(
          result.revokedSessionCount > 0
            ? `Password updated. We signed out ${result.revokedSessionCount} session${result.revokedSessionCount === 1 ? "" : "s"}.`
            : "Password updated.",
        ),
      );
    } catch (error) {
      setFeedback(failure(error, "Unable to set your new password."));
    }
  }

  if (step === "done") {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <AuthFeedbackNote feedback={feedback} />
        <Link href="/login" style={{ color: cssVar("primary"), fontSize: 14 }}>
          Back to sign in
        </Link>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form
        style={{ display: "grid", gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          void submitPassword();
        }}
      >
        <PasswordField
          value={password}
          onChange={setPassword}
          label="New password"
          autoComplete="new-password"
          disabled={busy}
          showStrength
          minLength={minLength}
        />
        <AuthFeedbackNote feedback={feedback} />
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Set new password"}
        </Button>
      </form>
    );
  }

  if (step === "verify" && challenge !== null) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 14, color: cssVar("mutedText") }}>
          Enter the {challenge.codeLength}-digit code sent to{" "}
          <strong>{challenge.destinationHint}</strong>.
        </p>
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(entered) => void verifyCode(entered)}
          length={challenge.codeLength}
          disabled={busy}
          invalid={feedback.status === "error"}
          autoFocus
        />
        <AuthFeedbackNote feedback={feedback} />
        {challenge.debugCode === undefined ? null : (
          <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
            Development code: <code>{challenge.debugCode}</code>
          </p>
        )}
        <Button
          onClick={() => void verifyCode(code)}
          disabled={busy || code.length < challenge.codeLength}
        >
          Continue
        </Button>
        <button
          type="button"
          onClick={() => void sendCode()}
          disabled={busy || cooldown > 0}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            justifySelf: "start",
            color: cssVar("primary"),
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
        </button>
      </div>
    );
  }

  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={(event) => {
        event.preventDefault();
        void sendCode();
      }}
    >
      <TextField
        label="Phone or email"
        value={identifier}
        onChange={setIdentifier}
        placeholder="7010358490 or you@example.com"
        autoComplete="username"
        disabled={busy}
        hint="We send a one-time code to confirm it is you."
        autoFocus
      />
      <AuthFeedbackNote feedback={feedback} />
      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send reset code"}
      </Button>
      <Link href="/login" style={{ color: cssVar("primary"), fontSize: 13 }}>
        Back to sign in
      </Link>
    </form>
  );
}
