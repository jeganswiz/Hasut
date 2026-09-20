import type { AdminMemberDetail, AdminMemberView, MemberRole } from "@hasut/types";
import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { memberRolesPatchSchema } from "@hasut/validation";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";

@ApiTags("admin-members")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin/members")
export class AdminMembersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Search members by display name. Phone is never returned." })
  search(
    @CurrentUser() user: RequestAuthContext,
    @Query("q") query?: string,
  ): Promise<AdminMemberView[]> {
    return this.users.searchMembers(user.roles, query ?? "");
  }

  @Get(":id")
  @ApiOperation({ summary: "Member detail without phone" })
  detail(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") memberId: string,
  ): Promise<AdminMemberDetail> {
    return this.users.getAdminDetail(user.roles, memberId);
  }

  @Post(":id/suspend")
  @ApiOperation({ summary: "Suspend a member and revoke sessions" })
  suspend(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") memberId: string,
    @Req() req: Request,
  ): Promise<AdminMemberDetail> {
    return this.users.setStatus(
      user.memberId,
      user.roles,
      memberId,
      "SUSPENDED",
      getRequestId(req),
    );
  }

  @Post(":id/restore")
  @ApiOperation({ summary: "Restore a suspended member" })
  restore(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") memberId: string,
    @Req() req: Request,
  ): Promise<AdminMemberDetail> {
    return this.users.setStatus(user.memberId, user.roles, memberId, "ACTIVE", getRequestId(req));
  }

  @Post(":id/sessions/revoke")
  @ApiOperation({ summary: "Revoke active sessions" })
  revoke(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") memberId: string,
    @Req() req: Request,
  ): Promise<AdminMemberDetail> {
    return this.users.revokeSessions(user.memberId, user.roles, memberId, getRequestId(req));
  }

  @Patch(":id/roles")
  @ApiOperation({
    summary: "Replace staff roles. MEMBER is always retained. Phone is never returned.",
  })
  setRoles(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") memberId: string,
    @Body(new ZodValidationPipe(memberRolesPatchSchema)) body: { roles: MemberRole[] },
    @Req() req: Request,
  ): Promise<AdminMemberDetail> {
    return this.users.setRoles(user.memberId, user.roles, memberId, body.roles, getRequestId(req));
  }
}
