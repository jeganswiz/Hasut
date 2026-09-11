import { SetMetadata } from "@nestjs/common";
import type { MemberRole } from "@hasut/types";

export const ROLES_KEY = "roles";

export const Roles = (...roles: MemberRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
