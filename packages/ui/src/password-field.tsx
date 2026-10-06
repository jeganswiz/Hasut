"use client";

import { passwordStrength, type PasswordStrength } from "@hasut/utils";
import { useId, useState } from "react";
import { cn } from "./lib/utils";

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

function strengthClass(strength: PasswordStrength): string {
  if (strength === "strong") {
    return "text-success";
  }
  return strength === "fair" ? "text-warning" : "text-destructive";
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

  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="relative">
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
          className={cn(
            "h-11 w-full rounded-sm border-[1.5px] bg-card px-3 pr-[76px] text-base text-foreground outline-offset-2",
            invalid ? "border-destructive" : "border-border",
          )}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          // Toggling visibility must never move focus away from the field.
          tabIndex={-1}
          aria-hidden
          className="absolute right-2 top-1/2 min-h-8 -translate-y-1/2 border-0 bg-transparent px-2.5 text-[13px] text-primary"
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </div>
      {showStrength ? (
        <p id={hintId} className="m-0 text-[13px] text-muted-foreground">
          {/* An untouched field has not failed anything yet, so it stays neutral. */}
          {value.length === 0 ? (
            minLength === undefined ? null : (
              `At least ${minLength} characters`
            )
          ) : (
            <>
              <span className={cn("font-semibold", strengthClass(strength))}>
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
