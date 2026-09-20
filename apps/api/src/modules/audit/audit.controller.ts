import type { AuditLogView } from "@hasut/types";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditService } from "./audit.service";

@ApiTags("admin-audit")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin/audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Audit log viewer. Phone and exact coordinates are not included." })
  list(
    @CurrentUser() user: RequestAuthContext,
    @Query("entity") entity?: string,
    @Query("actorId") actorId?: string,
    @Query("requestId") requestId?: string,
  ): Promise<AuditLogView[]> {
    return this.audit.list(user.roles, { entity, actorId, requestId });
  }
}
