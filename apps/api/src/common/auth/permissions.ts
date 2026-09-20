import type { MemberRole } from "@hasut/types";

export const ROLE_PERMISSIONS: Record<MemberRole, readonly string[]> = {
  MEMBER: ["me:read"],
  SUPPORT_AGENT: ["me:read", "admin:read", "admin:support"],
  MODERATOR: ["me:read", "admin:read", "admin:moderate"],
  ADMIN: ["*"],
};

export function permissionsFor(roles: readonly MemberRole[]): Set<string> {
  const granted = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      granted.add(permission);
    }
  }
  return granted;
}

export function hasPermission(roles: readonly MemberRole[], required: string): boolean {
  const granted = permissionsFor(roles);
  return granted.has("*") || granted.has(required);
}
