import { isE164Phone, normalizePhoneE164 } from "./phone";

describe("phone E.164", () => {
  it("normalizes spaced Indian numbers", () => {
    expect(normalizePhoneE164("+91 98765 43210")).toBe("+919876543210");
  });

  it("accepts a 10-digit Indian mobile", () => {
    expect(isE164Phone("7010358490")).toBe(true);
    expect(normalizePhoneE164("7010358490")).toBe("+917010358490");
  });

  it("rejects a number that is not E.164 or an Indian mobile", () => {
    expect(isE164Phone("12345")).toBe(false);
    expect(() => normalizePhoneE164("12345")).toThrow("Invalid E.164 phone number");
  });
});
