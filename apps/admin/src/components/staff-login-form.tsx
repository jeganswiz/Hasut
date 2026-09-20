"use client";

import { apiErrorMessage, hasutErrorCode } from "@hasut/api-client";
import type { AuthClientConfig, AuthVerifyResult, OtpChallengeReceipt } from "@hasut/types";
import { Button, OtpInput, PasswordField, TextField, cssVar } from "@hasut/ui";
import { isEmail } from "@hasut/utils";
import { useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

type Status = "idle" | "loading" | "error" | "success";

interface Feedback {
  status: Status;
  message: string;
}

const IDLE: Feedback = { status: "idle", message: "" };

/** Staff sign-in never advertises which accounts exist or carry a second step. */
function describe(error: unknown): Feedback {
  const code = hasutErrorCode(error);
  if (code === "RATE_LIMITED") {
    return { status: "error", message: "Too many attempts. Wait a few minutes and try again." };
  }
  if (code === "FORBIDDEN" || code === "ACCOUNT_SUSPENDED") {
    return { status: "error", message: "This account cannot access the admin console." };
  }
  if (code === "OTP_INVALID" || code === "OTP_EXPIRED") {
    return { status: "error", message: "That code is not valid. Request a new one." };
  }
  return { status: "error", message: apiErrorMessage(error, "Unable to sign in.") };
}

export function StaffLoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallengeReceipt | null>(null);
  const [config, setConfig] = useState<AuthClientConfig | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(IDLE);

  const busy = feedback.status === "loading";

  useEffect(() => {
    let cancelled = false;
    void createAdminApiClient()
      .authConfig()
      .then((loaded) => {
        if (!cancelled) {
          setConfig(loaded);
        }
      })
      .catch(() => {
        /* Sign-in still works without the published policy. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function finish(result: AuthVerifyResult): Promise<void> {
    await adminTokenStorage.setSession(result.tokens);
    setFeedback({ status: "success", message: "Verified. Opening the console…" });
    window.location.assign(nextPath);
  }

  async function submitCredentials(): Promise<void> {
    if (!isEmail(email)) {
      setFeedback({ status: "error", message: "Enter your staff email address." });
      return;
    }
    if (password.length === 0) {
      setFeedback({ status: "error", message: "Enter your password." });
      return;
    }
    setFeedback({ status: "loading", message: "Verifying credentials…" });
    try {
      const result = await createAdminApiClient().loginWithPassword({ email, password });
      if (result.status === "TWO_FACTOR_REQUIRED") {
        setChallenge(result.challenge);
        setCode("");
        setFeedback({
          status: "success",
          message: `Step 2 of 2. Code sent to ${result.challenge.destinationHint}.`,
        });
        return;
      }
      await finish(result);
    } catch (error) {
      setFeedback(describe(error));
    }
  }

  async function submitSecondFactor(entered: string): Promise<void> {
    if (challenge === null) {
      return;
    }
    setFeedback({ status: "loading", message: "Verifying code…" });
    try {
      const result = await createAdminApiClient().verifyTwoFactor({
        challengeId: challenge.challengeId,
        code: entered,
      });
      await finish(result);
    } catch (error) {
      setCode("");
      setFeedback(describe(error));
    }
  }

  return (
    <div className="staff-login-form">
      <ol className="staff-steps" aria-label="Sign-in steps">
        <li aria-current={challenge === null ? "step" : undefined} data-done={challenge !== null}>
          <span>1</span> Email and password
        </li>
        <li aria-current={challenge !== null ? "step" : undefined}>
          <span>2</span> Phone verification
        </li>
      </ol>

      {challenge === null ? (
        <form
          className="staff-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCredentials();
          }}
        >
          <TextField
            label="Staff email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@hasut.app"
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
          <FeedbackNote feedback={feedback} />
          <Button type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Continue"}
          </Button>
        </form>
      ) : (
        <div className="staff-stack">
          <p className="staff-note">
            Two-step verification is required for this account. Enter the {challenge.codeLength}
            -digit code sent to <strong>{challenge.destinationHint}</strong>.
          </p>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(entered) => void submitSecondFactor(entered)}
            length={challenge.codeLength}
            disabled={busy}
            invalid={feedback.status === "error"}
            autoFocus
            label="Staff verification code"
          />
          <FeedbackNote feedback={feedback} />
          {challenge.debugCode === undefined ? null : (
            <p className="staff-note">
              Development code: <code>{challenge.debugCode}</code>
            </p>
          )}
          <Button
            onClick={() => void submitSecondFactor(code)}
            disabled={busy || code.length < challenge.codeLength}
          >
            Verify and open console
          </Button>
          <button
            type="button"
            className="staff-link"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setPassword("");
              setFeedback(IDLE);
            }}
          >
            Start over
          </button>
        </div>
      )}

      {config === null ? null : (
        <p className="staff-note">
          Codes are {config.codeLength} digits and expire quickly. Staff accounts do not use
          third-party sign-in.
        </p>
      )}
    </div>
  );
}

function FeedbackNote({ feedback }: { feedback: Feedback }) {
  if (feedback.status === "idle" || feedback.message.length === 0) {
    return <div role="status" aria-live="polite" style={{ minHeight: 20 }} />;
  }
  const tone =
    feedback.status === "error"
      ? cssVar("danger")
      : feedback.status === "success"
        ? cssVar("success")
        : cssVar("mutedText");
  return (
    <div
      role={feedback.status === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{ minHeight: 20, fontSize: 14, color: tone }}
    >
      {feedback.message}
    </div>
  );
}
