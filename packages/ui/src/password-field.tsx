"use client";

import { passwordStrength, type PasswordStrength } from "@hasut/utils";
import { useId, useState, type CSSProperties } from "react";
import { cssVar } from "./tokens";

export interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  autoComplete?: "current-password" | "new-password";
  disabled?: boolean;
  invalid?: boolean;
  /** Shows the advisory strength meter. Use on create/reset, not on sign in. */
  showStrength?: boolean;
  minLength?: number;
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
};

function strengthToken(strength: PasswordStrength): string {
  if (strength === "strong") {
    return cssVar("success");
  }
  return strength === "fair" ? cssVar("warning") : cssVar("danger");
}

export function PasswordField({
  value,
  onChange,
  label = "Password",
  placeholder,
  autoComplete = "current-password",
  disabled = false,
  invalid = false,
  showStrength = false,
  minLength,
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const strength = passwordStrength(value);

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "12px 76px 12px 12px",
    fontSize: 16,
    color: cssVar("text"),
    background: cssVar("surface"),
    border: `1.5px solid ${invalid ? cssVar("danger") : cssVar("border")}`,
    borderRadius: cssVar("radius"),
    outlineOffset: 2,
    transition: "border-color 160ms ease",
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label htmlFor={inputId} style={{ fontSize: 14, color: cssVar("mutedText") }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={inputId}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={showStrength ? hintId : undefined}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          // Toggling visibility must never move focus away from the field.
          tabIndex={-1}
          aria-hidden
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            minHeight: 32,
            padding: "0 10px",
            fontSize: 13,
            color: cssVar("primary"),
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </div>
      {showStrength ? (
        <p id={hintId} style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
          {/* An untouched field has not failed anything yet, so it stays neutral. */}
          {value.length === 0 ? (
            minLength === undefined ? null : (
              `At least ${minLength} characters`
            )
          ) : (
            <>
              <span style={{ color: strengthToken(strength), fontWeight: 600 }}>
                {STRENGTH_LABEL[strength]}
              </span>
              {minLength === undefined ? null : ` · at least ${minLength} characters`}
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
