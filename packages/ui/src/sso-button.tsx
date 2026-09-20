"use client";

import type { IdentityProviderName } from "@hasut/types";
import { cssVar } from "./tokens";

export interface SsoButtonProps {
  provider: IdentityProviderName;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}

const LABEL: Record<IdentityProviderName, string> = {
  GOOGLE: "Continue with Google",
  FACEBOOK: "Continue with Facebook",
};

/** Brand glyphs are drawn from the provider's own mark, not a theme token. */
function Glyph({ provider }: { provider: IdentityProviderName }) {
  if (provider === "GOOGLE") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#1877F2"
        d="M18 9a9 9 0 1 0-10.41 8.89v-6.29H5.31V9h2.28V7.02c0-2.25 1.34-3.5 3.4-3.5.98 0 2.01.18 2.01.18v2.21h-1.13c-1.12 0-1.47.7-1.47 1.41V9h2.5l-.4 2.6h-2.1v6.29A9 9 0 0 0 18 9Z"
      />
    </svg>
  );
}

export function SsoButton({ provider, onClick, disabled = false, busy = false }: SsoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        minHeight: 44,
        fontSize: 15,
        fontWeight: 500,
        color: cssVar("text"),
        background: cssVar("surface"),
        border: `1.5px solid ${cssVar("border")}`,
        borderRadius: cssVar("buttonRadius"),
        cursor: disabled || busy ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "border-color 160ms ease, background 160ms ease",
      }}
    >
      <Glyph provider={provider} />
      {busy ? "Connecting…" : LABEL[provider]}
    </button>
  );
}
