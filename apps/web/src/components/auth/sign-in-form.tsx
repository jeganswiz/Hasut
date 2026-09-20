"use client";

import type { AuthVerifyResult, OtpChallengeReceipt } from "@hasut/types";
import { AuthTabs, Button, OtpInput, PasswordField, TextField, cssVar } from "@hasut/ui";
import { isEmail } from "@hasut/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { webTokenStorage } from "../../lib/token-storage";
import { AuthFeedbackNote } from "./auth-feedback";
import { SsoBlock } from "./sso-block";
import { useAuthConfig } from "./use-auth-config";

type Method = "password" | "code";

/** Phone or email, decided by what the member actually typed. */
function destinationFor(identifier: string): { phone?: string; email?: string } {
  const value = identifier.trim();
  return isEmail(value) ? { email: value } : { phone: value };
}

export function SignInForm({ nextPath }: { nextPath: string }) {
  const { config } = useAuthConfig();
  const [method, setMethod] = useState<Method>("password");
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallengeReceipt | null>(null);
  const [secondFactor, setSecondFactor] = useState<OtpChallengeReceipt | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const busy = feedback.status === "loading";
  const pending = secondFactor ?? challenge;

  // Live resend countdown for whichever challenge is on screen.
  useEffect(() => {
    if (pending === null) {
      setCooldown(0);
      return;
    }
    const tick = () => setCooldown(cooldownSeconds(pending.resendAvailableAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pending]);

  function complete(result: AuthVerifyResult): void {
    void (async () => {
      await webTokenStorage.setSession(result.tokens);
      setFeedback(success("Signed in. Taking you in…"));
      window.location.assign(nextPath);
    })();
  }

  async function submitPassword(): Promise<void> {
    if (!isEmail(email)) {
      setFeedback({ status: "error", message: "Enter a valid email address." });
      return;
    }
    if (password.length === 0) {
      setFeedback({ status: "error", message: "Enter your password." });
      return;
    }
    setFeedback(loading("Checking your details…"));
    try {
      const result = await createWebApiClient().loginWithPassword({
        email,
        password,
        captchaToken: await captchaToken(config, "password_login"),
      });
      if (result.status === "TWO_FACTOR_REQUIRED") {
        setSecondFactor(result.challenge);
        setCode("");
        setFeedback(success(`We sent a code to ${result.challenge.destinationHint}.`));
        return;
      }
      complete(result);
    } catch (error) {
      setFeedback(failure(error, "Unable to sign in."));
    }
  }

  async function sendCode(resend = false): Promise<void> {
    if (identifier.trim().length === 0) {
      setFeedback({ status: "error", message: "Enter your phone number or email." });
      return;
    }
    setFeedback(loading(resend ? "Sending a new code…" : "Sending your code…"));
    try {
      const client = createWebApiClient();
      const body = {
        ...destinationFor(identifier),
        purpose: "LOGIN" as const,
        captchaToken: await captchaToken(config, resend ? "otp_resend" : "otp_request"),
      };
      const receipt = resend ? await client.resendOtp(body) : await client.requestOtp(body);
      setChallenge(receipt);
      setCode("");
      setFeedback(
        success(`Enter the ${receipt.codeLength}-digit code sent to ${receipt.destinationHint}.`),
      );
    } catch (error) {
      setFeedback(failure(error, "Unable to send a code."));
    }
  }

  async function submitCode(entered: string): Promise<void> {
    setFeedback(loading("Verifying your code…"));
    try {
      const client = createWebApiClient();
      const result =
        secondFactor === null
          ? await client.verifyOtp({
              ...destinationFor(identifier),
              code: entered,
              purpose: "LOGIN",
            })
          : await client.verifyTwoFactor({
              challengeId: secondFactor.challengeId,
              code: entered,
            });
      complete(result);
    } catch (error) {
      setCode("");
      setFeedback(failure(error, "Unable to verify that code."));
    }
  }

  async function resendSecondFactor(): Promise<void> {
    // The second factor goes to the account's own channel, so restart the step.
    setSecondFactor(null);
    setCode("");
    await submitPassword();
  }

  const debugCode = useMemo(() => pending?.debugCode ?? null, [pending]);

  if (secondFactor !== null) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <p style={{ margin: 0, fontSize: 14, color: cssVar("mutedText") }}>
          Two-step verification is on for this account. Enter the code we sent to{" "}
          <strong>{secondFactor.destinationHint}</strong>.
        </p>
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(entered) => void submitCode(entered)}
          length={secondFactor.codeLength}
          disabled={busy}
          invalid={feedback.status === "error"}
          autoFocus
          label="Two-step verification code"
        />
        <AuthFeedbackNote feedback={feedback} />
        {debugCode === null ? null : <DevCode code={debugCode} />}
        <Button
          onClick={() => void submitCode(code)}
          disabled={busy || code.length < secondFactor.codeLength}
        >
          Verify and sign in
        </Button>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <button
            type="button"
            onClick={() => void resendSecondFactor()}
            disabled={busy}
            style={linkButton}
          >
            Send a new code
          </button>
          <button
            type="button"
            onClick={() => {
              setSecondFactor(null);
              setCode("");
              setFeedback(IDLE);
            }}
            style={linkButton}
          >
            Use a different account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AuthTabs
        label="Sign-in method"
        active={method}
        onChange={(next) => {
          setMethod(next);
          setFeedback(IDLE);
        }}
        tabs={[
          { id: "password", label: "Password" },
          { id: "code", label: "One-time code" },
        ]}
      />

      {method === "password" ? (
        <form
          style={{ display: "grid", gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            void submitPassword();
          }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            disabled={busy}
            autoFocus
          />
          <PasswordField
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={busy}
          />
          <AuthFeedbackNote feedback={feedback} />
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <Link href="/forgot-password" style={{ color: cssVar("primary") }}>
              Forgot password?
            </Link>
          </div>
        </form>
      ) : (
        <form
          style={{ display: "grid", gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (challenge === null) {
              void sendCode();
              return;
            }
            void submitCode(code);
          }}
        >
          <TextField
            label="Phone or email"
            value={identifier}
            onChange={(next) => {
              setIdentifier(next);
              setChallenge(null);
            }}
            placeholder="7010358490 or you@example.com"
            autoComplete="username"
            disabled={busy}
            hint="We send a one-time code. Your phone number stays private."
            autoFocus
          />
          {challenge === null ? null : (
            <div style={{ display: "grid", gap: 10 }}>
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={(entered) => void submitCode(entered)}
                length={challenge.codeLength}
                disabled={busy}
                invalid={feedback.status === "error"}
                autoFocus
              />
              <button
                type="button"
                onClick={() => void sendCode(true)}
                disabled={busy || cooldown > 0}
                style={{ ...linkButton, justifySelf: "start" }}
              >
                {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
              </button>
            </div>
          )}
          <AuthFeedbackNote feedback={feedback} />
          {debugCode === null ? null : <DevCode code={debugCode} />}
          <Button type="submit" disabled={busy}>
            {challenge === null ? "Send code" : "Verify and sign in"}
          </Button>
        </form>
      )}

      <SsoBlock config={config} disabled={busy} onFeedback={setFeedback} onSignedIn={complete} />

      <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
        New to HASUT?{" "}
        <Link href="/register" style={{ color: cssVar("primary") }}>
          Create an account
        </Link>
      </p>
    </div>
  );
}

const linkButton = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: cssVar("primary"),
  fontSize: 13,
  cursor: "pointer",
} as const;

/** Only ever populated by the local console adapters. */
function DevCode({ code }: { code: string }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
      Development code: <code>{code}</code>
    </p>
  );
}
