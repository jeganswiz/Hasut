import type { MemberRole } from "@hasut/types";
import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { hasPermission } from "../auth/permissions";
import { getRequestUser } from "../auth/request-auth";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { HasutHttpException } from "../errors/hasut-http.exception";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      (requiredRoles === undefined || requiredRoles.length === 0) &&
      (requiredPermissions === undefined || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const user = getRequestUser(context.switchToHttp().getRequest<Request>());
    if (requiredRoles !== undefined && requiredRoles.length > 0) {
      const allowed =
        user.roles.includes("ADMIN") || requiredRoles.some((role) => user.roles.includes(role));
      if (!allowed) {
        throw new HasutHttpException("FORBIDDEN", "Insufficient role", HttpStatus.FORBIDDEN);
      }
    }
    if (requiredPermissions !== undefined) {
      const allowed = requiredPermissions.every((permission) =>
        hasPermission(user.roles, permission),
      );
      if (!allowed) {
        throw new HasutHttpException("FORBIDDEN", "Insufficient permission", HttpStatus.FORBIDDEN);
      }
    }
    return true;
  }
}
