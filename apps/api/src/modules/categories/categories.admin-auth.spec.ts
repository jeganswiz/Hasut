import "reflect-metadata";
import type { MemberRole } from "@hasut/types";
import type { ExecutionContext } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { CategoriesController } from "./categories.controller";

function contextWithRoles(roles: MemberRole[]): ExecutionContext {
  return {
    getHandler: () => CategoriesController.prototype.create,
    getClass: () => CategoriesController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { memberId: "member-1", roles, sessionId: "session-1" } }),
    }),
  } as unknown as ExecutionContext;
}

describe("admin category authorization", () => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === ROLES_KEY) {
        return ["ADMIN"];
      }
      return undefined;
    }),
  };

  it("requires ADMIN on category write routes", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, CategoriesController.prototype.create) as
      MemberRole[] | undefined;
    expect(roles).toEqual(["ADMIN"]);
  });

  it("rejects a member from creating categories", () => {
    const guard = new RolesGuard(reflector as never);
    expect(() => guard.canActivate(contextWithRoles(["MEMBER"]))).toThrow(HasutHttpException);
  });

  it("allows an admin to create categories", () => {
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(contextWithRoles(["ADMIN"]))).toBe(true);
  });
});
