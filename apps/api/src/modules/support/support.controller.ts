import type {
  SupportCategoryView,
  SupportEscalationView,
  SupportMessageView,
  SupportNoteView,
  SupportTicketDetail,
  SupportTicketView,
} from "@hasut/types";
import {
  supportCategoryWriteSchema,
  supportEscalateSchema,
  supportMessageCreateSchema,
  supportNoteCreateSchema,
  supportTicketAssignSchema,
  supportTicketCreateSchema,
  supportTicketPatchSchema,
} from "@hasut/validation";
import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SupportService } from "./support.service";

@ApiTags("support")
@ApiBearerAuth()
@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get("support/categories")
  @ApiOperation({ summary: "Active support categories" })
  listCategories(): Promise<SupportCategoryView[]> {
    return this.support.listCategories(true);
  }

  @Post("support/tickets")
  @ApiOperation({ summary: "Open a support ticket" })
  create(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(supportTicketCreateSchema))
    body: z.infer<typeof supportTicketCreateSchema>,
    @Req() req: Request,
  ): Promise<SupportTicketDetail> {
    return this.support.createTicket(memberId, body, getRequestId(req));
  }

  @Get("support/tickets")
  @ApiOperation({ summary: "Your support tickets" })
  listMine(@CurrentUser("memberId") memberId: string): Promise<SupportTicketView[]> {
    return this.support.listMemberTickets(memberId);
  }

  @Get("support/tickets/:id")
  @ApiOperation({ summary: "Support ticket thread" })
  getOne(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") ticketId: string,
  ): Promise<SupportTicketDetail> {
    return this.support.getTicket(user.memberId, user.roles, ticketId);
  }

  @Post("support/tickets/:id/messages")
  @ApiOperation({ summary: "Reply on a support ticket" })
  addMessage(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(supportMessageCreateSchema))
    body: z.infer<typeof supportMessageCreateSchema>,
    @Req() req: Request,
  ): Promise<SupportMessageView> {
    return this.support.addMessage(
      user.memberId,
      user.roles,
      ticketId,
      body.body,
      getRequestId(req),
    );
  }

  @Roles("ADMIN")
  @Get("admin/support/categories")
  @ApiOperation({ summary: "All support categories" })
  listAdminCategories(): Promise<SupportCategoryView[]> {
    return this.support.listCategories(false);
  }

  @Roles("ADMIN")
  @Post("admin/support/categories")
  @ApiOperation({ summary: "Create a support category" })
  createCategory(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(supportCategoryWriteSchema))
    body: z.infer<typeof supportCategoryWriteSchema>,
    @Req() req: Request,
  ): Promise<SupportCategoryView> {
    return this.support.createCategory(user.memberId, user.roles, body, getRequestId(req));
  }

  @Roles("ADMIN", "SUPPORT_AGENT")
  @Get("admin/support/tickets")
  @ApiOperation({ summary: "Support ticket queue" })
  listQueue(@CurrentUser() user: RequestAuthContext): Promise<SupportTicketView[]> {
    return this.support.listQueue(user.roles);
  }

  @Roles("ADMIN", "SUPPORT_AGENT")
  @Post("admin/support/tickets/:id/assign")
  @ApiOperation({ summary: "Assign a support ticket" })
  assign(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(supportTicketAssignSchema))
    body: z.infer<typeof supportTicketAssignSchema>,
    @Req() req: Request,
  ): Promise<SupportTicketView> {
    return this.support.assign(
      user.memberId,
      user.roles,
      ticketId,
      body.assigneeId,
      getRequestId(req),
    );
  }

  @Roles("ADMIN", "SUPPORT_AGENT")
  @Post("admin/support/tickets/:id/notes")
  @ApiOperation({ summary: "Add an internal support note" })
  addNote(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(supportNoteCreateSchema))
    body: z.infer<typeof supportNoteCreateSchema>,
    @Req() req: Request,
  ): Promise<SupportNoteView> {
    return this.support.addNote(user.memberId, user.roles, ticketId, body.body, getRequestId(req));
  }

  @Roles("ADMIN", "SUPPORT_AGENT")
  @Post("admin/support/tickets/:id/escalate")
  @ApiOperation({ summary: "Escalate a support ticket" })
  escalate(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(supportEscalateSchema)) body: z.infer<typeof supportEscalateSchema>,
    @Req() req: Request,
  ): Promise<SupportEscalationView> {
    return this.support.escalate(user.memberId, user.roles, ticketId, body, getRequestId(req));
  }

  @Roles("ADMIN", "SUPPORT_AGENT")
  @Patch("admin/support/tickets/:id")
  @ApiOperation({ summary: "Update support ticket status or priority" })
  patch(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") ticketId: string,
    @Body(new ZodValidationPipe(supportTicketPatchSchema))
    body: z.infer<typeof supportTicketPatchSchema>,
    @Req() req: Request,
  ): Promise<SupportTicketView> {
    return this.support.patchTicket(user.memberId, user.roles, ticketId, body, getRequestId(req));
  }
}
