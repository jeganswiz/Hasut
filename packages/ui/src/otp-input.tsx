"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  applyArrow,
  applyBackspace,
  applyPaste,
  applyType,
  isComplete,
  type OtpState,
} from "./otp-input.logic";
import { cssVar } from "./tokens";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired once the last box is filled, so the form can submit without a click. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
  /** Ties the group to visible error text for screen readers. */
  describedBy?: string;
}

function boxStyle(filled: boolean, invalid: boolean, disabled: boolean): CSSProperties {
  return {
    width: 48,
    height: 56,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 600,
    lineHeight: "1",
    color: cssVar("text"),
    background: disabled ? cssVar("background") : cssVar("surface"),
    border: `1.5px solid ${invalid ? cssVar("danger") : filled ? cssVar("primary") : cssVar("border")}`,
    borderRadius: cssVar("radius"),
    outlineOffset: 2,
    transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
    caretColor: cssVar("primary"),
  };
}

/**
 * Six separate boxes that behave like one field: typing advances, backspace
 * retreats, arrows move, and pasting a whole code fills every box at once.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  label = "Verification code",
  describedBy,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, "").slice(0, length).split("");

  const focusBox = useCallback((index: number) => {
    const target = refs.current[Math.max(0, Math.min(index, refs.current.length - 1))];
    target?.focus();
    target?.select();
  }, []);

  useEffect(() => {
    if (autoFocus) {
      focusBox(0);
    }
  }, [autoFocus, focusBox]);

  function commit(state: OtpState): void {
    onChange(state.value);
    focusBox(state.focusIndex);
    if (isComplete(state.value, length)) {
      onComplete?.(state.value);
    }
  }

  function handleInput(index: number, raw: string): void {
    commit(applyType(value, index, raw, length));
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Backspace") {
      event.preventDefault();
      commit(applyBackspace(value, index, length));
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(applyArrow(index, -1, length));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(applyArrow(index, 1, length));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData("text");
    if (pasted.replace(/\D/g, "").length === 0) {
      return;
    }
    event.preventDefault();
    commit(applyPaste(pasted, length));
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      style={{ display: "flex", gap: 10, flexWrap: "nowrap" }}
    >
      {Array.from({ length }, (_, index) => {
        const digit = digits[index] ?? "";
        return (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={digit}
            onChange={(event) => handleInput(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.currentTarget.select()}
            disabled={disabled}
            inputMode="numeric"
            // One-time-code autofill only makes sense on the first box.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${label} digit ${index + 1}`}
            aria-invalid={invalid || undefined}
            maxLength={length}
            style={boxStyle(digit !== "", invalid, disabled)}
          />
        );
      })}
    </div>
  );
}
