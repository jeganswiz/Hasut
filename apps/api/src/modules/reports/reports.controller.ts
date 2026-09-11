import type { BlockView, ReportView } from "@hasut/types";
import { blockCreateSchema, reportCreateSchema } from "@hasut/validation";
import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
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
}
