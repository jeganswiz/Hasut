import { otpRequestSchema, otpVerifySchema } from "./auth";

describe("auth validation", () => {
  it("accepts an E.164 login request", () => {
    const parsed = otpRequestSchema.parse({ phone: "+91 98765 43210" });
    expect(parsed.phone).toBe("+919876543210");
    expect(parsed.purpose).toBe("LOGIN");
  });

  it("accepts a 10-digit Indian mobile", () => {
    const parsed = otpRequestSchema.parse({ phone: "7010358490" });
    expect(parsed.phone).toBe("+917010358490");
  });

  it("rejects a number that is not E.164 or an Indian mobile", () => {
    const result = otpRequestSchema.safeParse({ phone: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric OTP", () => {
    const result = otpVerifySchema.safeParse({ phone: "+919876543210", code: "abcd" });
    expect(result.success).toBe(false);
  });
});
