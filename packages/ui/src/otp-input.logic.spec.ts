import { applyArrow, applyBackspace, applyPaste, applyType, isComplete } from "./otp-input.logic";

const LENGTH = 6;

describe("otp input logic", () => {
  it("advances focus as each digit is typed", () => {
    let state = { value: "", focusIndex: 0 };
    for (const digit of "1234") {
      state = applyType(state.value, state.focusIndex, digit, LENGTH);
    }
    expect(state).toEqual({ value: "1234", focusIndex: 4 });
  });

  it("does not advance past the last box", () => {
    const state = applyType("12345", 5, "6", LENGTH);
    expect(state).toEqual({ value: "123456", focusIndex: 5 });
  });

  it("ignores non-numeric keystrokes", () => {
    expect(applyType("12", 2, "a", LENGTH)).toEqual({ value: "12", focusIndex: 2 });
  });

  it("spreads an autofilled code delivered into one box", () => {
    expect(applyType("", 0, "483920", LENGTH)).toEqual({ value: "483920", focusIndex: 5 });
  });

  it("clears the current box on backspace without moving", () => {
    expect(applyBackspace("1234", 3, LENGTH)).toEqual({ value: "123", focusIndex: 3 });
  });

  it("steps back and clears when backspacing an empty box", () => {
    expect(applyBackspace("123", 3, LENGTH)).toEqual({ value: "12", focusIndex: 2 });
  });

  it("does not step before the first box", () => {
    expect(applyBackspace("", 0, LENGTH)).toEqual({ value: "", focusIndex: 0 });
  });

  it("fills every box from a pasted code and strips separators", () => {
    expect(applyPaste("48-39 20", LENGTH)).toEqual({ value: "483920", focusIndex: 5 });
  });

  it("truncates a pasted value longer than the field", () => {
    expect(applyPaste("1234567890", LENGTH)).toEqual({ value: "123456", focusIndex: 5 });
  });

  it("parks focus on the next empty box for a short paste", () => {
    expect(applyPaste("123", LENGTH)).toEqual({ value: "123", focusIndex: 3 });
  });

  it("clamps arrow navigation to the field bounds", () => {
    expect(applyArrow(0, -1, LENGTH)).toBe(0);
    expect(applyArrow(5, 1, LENGTH)).toBe(5);
    expect(applyArrow(2, 1, LENGTH)).toBe(3);
  });

  it("reports completion only when every box is filled", () => {
    expect(isComplete("12345", LENGTH)).toBe(false);
    expect(isComplete("123456", LENGTH)).toBe(true);
  });
});
