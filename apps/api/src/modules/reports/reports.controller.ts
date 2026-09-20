import type { AdminReportView, BlockView, ReportView } from "@hasut/types";
import { blockCreateSchema, reportCreateSchema, reportModerateSchema } from "@hasut/validation";
import { Body, Controller, Delete, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ReportsService } from "./reports.service";

type BlockCreate = z.infer<typeof blockCreateSchema>;
type ReportCreate = z.infer<typeof reportCreateSchema>;

@ApiTags("reports")
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("blocks")
  @ApiOperation({ summary: "Members you have blocked" })
  listBlocks(@CurrentUser("memberId") memberId: string): Promise<BlockView[]> {
    return this.reports.listBlocks(memberId);
  }

  @Post("blocks")
  @ApiOperation({ summary: "Block a member — prevents connect and chat" })
  block(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(blockCreateSchema)) body: BlockCreate,
  ): Promise<BlockView> {
    return this.reports.block(memberId, body.memberId);
  }

  @Delete("blocks/:memberId")
  @ApiOperation({ summary: "Remove a block" })
  unblock(
    @CurrentUser("memberId") memberId: string,
    @Param("memberId") targetId: string,
  ): Promise<{ removed: boolean }> {
    return this.reports.unblock(memberId, targetId);
  }

  @Post("reports")
  @ApiOperation({ summary: "Report a member or piece of content" })
  report(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(reportCreateSchema)) body: ReportCreate,
  ): Promise<ReportView> {
    return this.reports.createReport(memberId, body);
  }

  @Roles("ADMIN", "MODERATOR")
  @Get("admin/reports")
  @ApiOperation({ summary: "Open reports queue" })
  listQueue(@CurrentUser() user: RequestAuthContext): Promise<AdminReportView[]> {
    return this.reports.listQueue(user.roles);
  }

  @Roles("ADMIN", "MODERATOR")
  @Post("admin/reports/:id/moderate")
  @ApiOperation({ summary: "Hide reported content or dismiss the report" })
  moderate(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") reportId: string,
    @Body(new ZodValidationPipe(reportModerateSchema)) body: z.infer<typeof reportModerateSchema>,
    @Req() req: Request,
  ): Promise<AdminReportView> {
    return this.reports.moderate(
      user.memberId,
      user.roles,
      reportId,
      body.action,
      getRequestId(req),
    );
  }
}
