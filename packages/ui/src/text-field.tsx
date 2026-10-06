"use client";

import { useId, type HTMLInputTypeAttribute } from "react";
import { Input } from "./components/input";
import { cn } from "./lib/utils";

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

  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        {label}
      </label>
      <Input
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
        className={cn(invalid && "border-destructive")}
      />
      {hint === undefined ? null : (
        <p id={hintId} className="m-0 text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
