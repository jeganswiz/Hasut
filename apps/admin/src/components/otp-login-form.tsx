"use client";

import { apiErrorMessage, isHasutApiError } from "@hasut/api-client";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

export function OtpLoginForm({ nextPath }: { nextPath: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [state, setState] = useState<SurfaceState>("empty");
  const [message, setMessage] = useState("Admins sign in with the same phone OTP used by members.");

  async function requestCode(): Promise<string | null> {
    const receipt = await createAdminApiClient().requestOtp({ phone, purpose: "LOGIN" });
    setDebugCode(receipt.debugCode ?? null);
    return receipt.debugCode ?? null;
  }

  async function verifyWith(otp: string): Promise<void> {
    const result = await createAdminApiClient().verifyOtp({ phone, code: otp, purpose: "LOGIN" });
    await adminTokenStorage.setSession(result.tokens);
    window.location.assign(nextPath);
  }

  async function sendCodeOnly(): Promise<void> {
    if (phone.trim().length === 0) {
      setState("error");
      setMessage("Enter your phone number.");
      return;
    }
    setState("loading");
    setMessage("Sending a one-time code…");
    try {
      await requestCode();
      setState("success");
      setMessage("Enter the code sent to your phone.");
    } catch (error) {
      setState("error");
      setMessage(apiErrorMessage(error, "Unable to send a code."));
    }
  }

  async function continueLogin(): Promise<void> {
    if (phone.trim().length === 0) {
      setState("error");
      setMessage("Enter your phone number.");
      return;
    }
    setState("loading");
    setMessage("Signing in…");
    try {
      let issued: string | null = null;
      try {
        issued = await requestCode();
      } catch (error) {
        const errorCode = isHasutApiError(error) ? error.envelope.error.code : undefined;
        if (errorCode !== "OTP_RESEND_COOLDOWN" && errorCode !== "RATE_LIMITED") {
          throw error;
        }
      }
      const otp = code.trim().length > 0 ? code.trim() : (issued ?? "");
      if (otp.length === 0) {
        setState("success");
        setMessage("Enter the code sent to your phone.");
        return;
      }
      await verifyWith(otp);
    } catch (error) {
      setState("error");
      setMessage(apiErrorMessage(error, "Unable to sign in."));
    }
  }

  return (
    <Surface state={state} title="Admin sign in">
      <p>{message}</p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void continueLogin();
        }}
      >
        <label>
          Phone
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="7010358490"
            autoComplete="tel"
          />
        </label>
        <label>
          Code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </label>
        {debugCode !== null ? <p className="hint">Development code: {debugCode}</p> : null}
        <div className="actions">
          <Button type="button" variant="secondary" onClick={() => void sendCodeOnly()}>
            Send code
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </Surface>
  );
}
