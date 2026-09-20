import "reflect-metadata";
import type { MemberRole } from "@hasut/types";
import type { ExecutionContext } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { VerificationController } from "./verification.controller";

function contextWithRoles(roles: MemberRole[], handler: string): ExecutionContext {
  const proto = VerificationController.prototype as unknown as Record<string, unknown>;
  return {
    getHandler: () => proto[handler],
    getClass: () => VerificationController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { memberId: "member-1", roles, sessionId: "session-1" } }),
    }),
  } as unknown as ExecutionContext;
}

describe("admin verification authorization", () => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === ROLES_KEY) {
        return ["ADMIN"];
      }
      return undefined;
    }),
  };

  it("requires ADMIN on decide", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, VerificationController.prototype.decide) as
      MemberRole[] | undefined;
    expect(roles).toEqual(["ADMIN"]);
  });

  it("rejects support agents from deciding identity verification", () => {
    const guard = new RolesGuard(reflector as never);
    expect(() => guard.canActivate(contextWithRoles(["SUPPORT_AGENT"], "decide"))).toThrow(
      HasutHttpException,
    );
  });

  it("allows an admin to decide", () => {
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(contextWithRoles(["ADMIN"], "decide"))).toBe(true);
  });
});
