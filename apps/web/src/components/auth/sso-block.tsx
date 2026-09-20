"use client";

import type { AuthClientConfig, AuthVerifyResult, IdentityProviderName } from "@hasut/types";
import { SsoButton, cssVar } from "@hasut/ui";
import { useState } from "react";
import { createWebApiClient } from "../../lib/api";
import { captchaToken } from "../../lib/captcha";
import { failure, loading, type AuthFeedback } from "../../lib/auth-flow";
import { SsoCancelled, ssoToken } from "../../lib/sso";

export interface SsoBlockProps {
  config: AuthClientConfig | null;
  disabled?: boolean;
  onFeedback: (feedback: AuthFeedback) => void;
  onSignedIn: (result: AuthVerifyResult) => void;
  divider?: boolean;
}

export function SsoBlock({
  config,
  disabled = false,
  onFeedback,
  onSignedIn,
  divider = true,
}: SsoBlockProps) {
  const [busy, setBusy] = useState<IdentityProviderName | null>(null);

  if (config === null || (!config.sso.google.enabled && !config.sso.facebook.enabled)) {
    return null;
  }

  async function start(provider: IdentityProviderName): Promise<void> {
    if (config === null) {
      return;
    }
    setBusy(provider);
    onFeedback(loading("Opening your provider…"));
    try {
      const token = await ssoToken(provider, {
        googleClientId: config.sso.google.clientId,
        facebookAppId: config.sso.facebook.appId,
      });
      const result = await createWebApiClient().loginWithSso({
        provider,
        token,
        captchaToken: await captchaToken(config, "sso_login"),
      });
      onSignedIn(result);
    } catch (error) {
      // A closed popup is a normal choice, not an error worth alarming about.
      onFeedback(
        error instanceof SsoCancelled
          ? { status: "idle", message: "" }
          : failure(error, "Unable to finish provider sign-in."),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {divider ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            color: cssVar("mutedText"),
          }}
        >
          <span style={{ flex: 1, height: 1, background: cssVar("border") }} />
          or
          <span style={{ flex: 1, height: 1, background: cssVar("border") }} />
        </div>
      ) : null}
      {config.sso.google.enabled ? (
        <SsoButton
          provider="GOOGLE"
          onClick={() => void start("GOOGLE")}
          disabled={disabled || busy !== null}
          busy={busy === "GOOGLE"}
        />
      ) : null}
      {config.sso.facebook.enabled ? (
        <SsoButton
          provider="FACEBOOK"
          onClick={() => void start("FACEBOOK")}
          disabled={disabled || busy !== null}
          busy={busy === "FACEBOOK"}
        />
      ) : null}
    </div>
  );
}
