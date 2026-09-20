import { destinationHint, destinationKey, resolveDestination } from "./otp-destination";

describe("otp destination", () => {
  it("resolves a phone to the SMS channel", () => {
    expect(resolveDestination({ phone: "+917010358490" })).toEqual({
      channel: "SMS",
      phoneE164: "+917010358490",
      email: null,
    });
  });

  it("resolves an email to the EMAIL channel", () => {
    expect(resolveDestination({ email: "jegan@example.com" })).toEqual({
      channel: "EMAIL",
      phoneE164: null,
      email: "jegan@example.com",
    });
  });

  it("rejects both or neither destination", () => {
    expect(() => resolveDestination({})).toThrow(/phone number or an email/);
    expect(() => resolveDestination({ phone: "+917010358490", email: "a@b.com" })).toThrow(
      /exactly one/,
    );
  });

  it("keys SMS and email buckets separately", () => {
    const phone = destinationKey(resolveDestination({ phone: "+917010358490" }));
    const email = destinationKey(resolveDestination({ email: "jegan@example.com" }));
    expect(phone).not.toBe(email);
    expect(phone.startsWith("phone:")).toBe(true);
    expect(email.startsWith("email:")).toBe(true);
  });

  it("never leaks a full destination in the hint", () => {
    const phone = destinationHint(resolveDestination({ phone: "+917010358490" }));
    expect(phone).toContain("8490");
    expect(phone).not.toContain("701035");

    const email = destinationHint(resolveDestination({ email: "jegan@example.com" }));
    expect(email).toBe("je•••@example.com");
  });
});
