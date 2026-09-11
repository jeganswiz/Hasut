import { hasPermission, permissionsFor } from "./permissions";

describe("permissions", () => {
  it("grants admin wildcard access", () => {
    expect(hasPermission(["ADMIN"], "admin:moderate")).toBe(true);
    expect(permissionsFor(["ADMIN"]).has("*")).toBe(true);
  });

  it("limits members to me:read", () => {
    expect(hasPermission(["MEMBER"], "me:read")).toBe(true);
    expect(hasPermission(["MEMBER"], "admin:read")).toBe(false);
  });
});
