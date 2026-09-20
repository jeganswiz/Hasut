"use client";

import { useId, type CSSProperties, type HTMLInputTypeAttribute } from "react";
import { cssVar } from "./tokens";

export interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  hint?: string;
  maxLength?: number;
}

export function TextField({
  value,
  onChange,
  label,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  disabled = false,
  invalid = false,
  autoFocus = false,
  hint,
  maxLength,
}: TextFieldProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const style: CSSProperties = {
    width: "100%",
    padding: 12,
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
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-describedby={hint === undefined ? undefined : hintId}
        style={style}
      />
      {hint === undefined ? null : (
        <p id={hintId} style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
          {hint}
        </p>
      )}
    </div>
  );
}
