import { AUTH_POLICY_DEFAULTS, isAuthPolicy } from "./auth-policy";

describe("isAuthPolicy", () => {
  it("accepts the seeded default policy", () => {
    expect(isAuthPolicy(AUTH_POLICY_DEFAULTS)).toBe(true);
  });

  it("rejects a partial object", () => {
    expect(isAuthPolicy({ maxAttempts: 5 })).toBe(false);
  });
});
