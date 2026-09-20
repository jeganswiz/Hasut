import { coerceEmail, isEmail, maskEmail, maskPhone, normalizeEmail } from "./email";

describe("email", () => {
  it("accepts and lowercases a valid address", () => {
    expect(normalizeEmail("  Jegan.M@Example.CO.IN ")).toBe("jegan.m@example.co.in");
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["jegan", "jegan@", "@example.com", "jegan@example", "a b@example.com"]) {
      expect(isEmail(bad)).toBe(false);
      expect(coerceEmail(bad)).toBeNull();
    }
  });

  it("masks the local part but keeps the domain readable", () => {
    expect(maskEmail("jegan@gmail.com")).toBe("je•••@gmail.com");
  });

  it("never reveals more than the last four phone digits", () => {
    expect(maskPhone("+917010358490")).toBe("•••••• 8490");
    expect(maskPhone("+917010358490")).not.toContain("701035");
  });
});
