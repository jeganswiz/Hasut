import {
  authLoginResultSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordForgotSchema,
  passwordLoginSchema,
  passwordRegisterSchema,
  passwordResetSchema,
} from "./auth";

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

  it("accepts an email OTP request and normalizes the address", () => {
    const parsed = otpRequestSchema.parse({ email: " Jegan@Example.COM ", purpose: "LOGIN" });
    expect(parsed.email).toBe("jegan@example.com");
    expect(parsed.phone).toBeUndefined();
  });

  it("rejects an OTP request with neither phone nor email", () => {
    expect(otpRequestSchema.safeParse({ purpose: "LOGIN" }).success).toBe(false);
  });

  it("rejects an OTP request carrying both phone and email", () => {
    const result = otpRequestSchema.safeParse({
      phone: "7010358490",
      email: "jegan@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password below the contract floor", () => {
    const result = passwordRegisterSchema.safeParse({
      email: "jegan@example.com",
      password: "short1!",
      displayName: "Jegan",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a registration with a strong password", () => {
    const parsed = passwordRegisterSchema.parse({
      email: "Jegan@Example.com",
      password: "Chennai-Patron-42",
      displayName: "Jegan M",
    });
    expect(parsed.email).toBe("jegan@example.com");
  });

  it("does not bound the length of an existing password on sign in", () => {
    const parsed = passwordLoginSchema.parse({ email: "a@b.com", password: "old" });
    expect(parsed.password).toBe("old");
  });

  it("requires exactly one destination when recovering a password", () => {
    expect(passwordForgotSchema.safeParse({ email: "jegan@example.com" }).success).toBe(true);
    expect(passwordForgotSchema.safeParse({}).success).toBe(false);
  });

  it("requires a reset ticket before setting a new password", () => {
    expect(passwordResetSchema.safeParse({ password: "Chennai-Patron-42" }).success).toBe(false);
  });

  it("parses a two-factor login result that carries no tokens", () => {
    const parsed = authLoginResultSchema.parse({
      status: "TWO_FACTOR_REQUIRED",
      challenge: {
        challengeId: "8f1b0a5e-6f4d-4a19-9a2c-7e9f5d1c2b3a",
        channel: "SMS",
        destinationHint: "•••••• 8490",
        expiresAt: "2026-09-21T00:00:00.000Z",
        resendAvailableAt: "2026-09-21T00:01:00.000Z",
        codeLength: 6,
      },
    });
    expect(parsed.status).toBe("TWO_FACTOR_REQUIRED");
    expect(parsed).not.toHaveProperty("tokens");
  });
});
