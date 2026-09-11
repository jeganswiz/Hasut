import "reflect-metadata";
import type { MemberRole } from "@hasut/types";
import type { ExecutionContext } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DiscoveryController } from "./discovery.controller";

function contextWithRoles(roles: MemberRole[]): ExecutionContext {
  return {
    getHandler: () => DiscoveryController.prototype.patchPolicy,
    getClass: () => DiscoveryController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { memberId: "member-1", roles, sessionId: "session-1" } }),
    }),
  } as unknown as ExecutionContext;
}

describe("admin discovery authorization", () => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === ROLES_KEY) {
        return ["ADMIN"];
      }
      return undefined;
    }),
  };

  it("requires ADMIN on discovery policy writes", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, DiscoveryController.prototype.patchPolicy) as
      MemberRole[] | undefined;
    expect(roles).toEqual(["ADMIN"]);
  });

  it("rejects a member from changing discovery defaults", () => {
    const guard = new RolesGuard(reflector as never);
    expect(() => guard.canActivate(contextWithRoles(["MEMBER"]))).toThrow(HasutHttpException);
  });

  it("allows an admin to change discovery defaults", () => {
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(contextWithRoles(["ADMIN"]))).toBe(true);
  });
});
