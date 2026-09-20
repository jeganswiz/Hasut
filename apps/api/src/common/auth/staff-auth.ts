import type { MemberRole } from "@hasut/types";
import { HttpStatus } from "@nestjs/common";
import { hasPermission } from "./permissions";
import { HasutHttpException } from "../errors/hasut-http.exception";

export function assertAdminRole(roles: readonly MemberRole[]): void {
  if (!roles.includes("ADMIN")) {
    throw new HasutHttpException("FORBIDDEN", "Admin access required", HttpStatus.FORBIDDEN);
  }
}

export function assertSupportAccess(roles: readonly MemberRole[]): void {
  if (!hasPermission(roles, "admin:support")) {
    throw new HasutHttpException("FORBIDDEN", "Support access required", HttpStatus.FORBIDDEN);
  }
}

export function assertModerationAccess(roles: readonly MemberRole[]): void {
  if (!hasPermission(roles, "admin:moderate")) {
    throw new HasutHttpException("FORBIDDEN", "Moderation access required", HttpStatus.FORBIDDEN);
  }
}

export function assertOpsReadAccess(roles: readonly MemberRole[]): void {
  if (!hasPermission(roles, "admin:read")) {
    throw new HasutHttpException("FORBIDDEN", "Operations access required", HttpStatus.FORBIDDEN);
  }
}
