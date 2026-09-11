import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";
import { TokenService } from "./token.service";

describe("TokenService", () => {
  const config = {
    get: () => "hasut-dev-access-secret-32chars-min",
  } as unknown as ConfigService<ApiEnv, true>;

  it("signs and verifies an access token", () => {
    const tokens = new TokenService(config);
    const jwt = tokens.signAccess({ sub: "member-1", sid: "session-1", roles: ["MEMBER"] }, 60);
    const claims = tokens.verifyAccess(jwt);
    expect(claims.sub).toBe("member-1");
    expect(claims.sid).toBe("session-1");
    expect(claims.roles).toEqual(["MEMBER"]);
  });

  it("rejects a tampered access token", () => {
    const tokens = new TokenService(config);
    expect(() => tokens.verifyAccess("not-a-jwt")).toThrow();
  });
});
