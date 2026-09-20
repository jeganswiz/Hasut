/**
 * Pure keystroke model for the six-box code field. Keeping it free of React
 * lets the focus rules be tested directly; the component only renders it.
 */
export interface OtpState {
  value: string;
  focusIndex: number;
}

function clampFocus(index: number, length: number): number {
  return Math.max(0, Math.min(index, length - 1));
}

function digitsOf(value: string, length: number): string[] {
  return value.replace(/\D/g, "").slice(0, length).split("");
}

function join(digits: string[], length: number): string {
  return digits.join("").replace(/\D/g, "").slice(0, length);
}

/** Typing a digit fills the current box and advances; non-digits are ignored. */
export function applyType(value: string, index: number, typed: string, length: number): OtpState {
  const clean = typed.replace(/\D/g, "");
  if (clean.length === 0) {
    return { value, focusIndex: clampFocus(index, length) };
  }
  // Autofill can drop the whole code into a single box.
  if (clean.length > 1) {
    const merged = join([...digitsOf(value, length).slice(0, index), ...clean], length);
    return { value: merged, focusIndex: clampFocus(index + clean.length, length) };
  }
  const digits = digitsOf(value, length);
  digits[index] = clean;
  return { value: join(digits, length), focusIndex: clampFocus(index + 1, length) };
}

/** Backspace clears the current box, or steps back and clears when already empty. */
export function applyBackspace(value: string, index: number, length: number): OtpState {
  const digits = digitsOf(value, length);
  if (digits[index] === undefined || digits[index] === "") {
    digits[index - 1] = "";
    return { value: join(digits, length), focusIndex: clampFocus(index - 1, length) };
  }
  digits[index] = "";
  return { value: join(digits, length), focusIndex: clampFocus(index, length) };
}

/** A pasted code fills from the start and parks focus on the last filled box. */
export function applyPaste(pasted: string, length: number): OtpState {
  const clean = pasted.replace(/\D/g, "").slice(0, length);
  return { value: clean, focusIndex: clampFocus(clean.length, length) };
}

export function applyArrow(index: number, direction: -1 | 1, length: number): number {
  return clampFocus(index + direction, length);
}

export function isComplete(value: string, length: number): boolean {
  return value.replace(/\D/g, "").length === length;
}
