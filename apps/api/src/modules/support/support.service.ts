import type {
  MemberPreview,
  MemberRole,
  SupportCategoryView,
  SupportEscalationView,
  SupportMessageView,
  SupportNoteView,
  SupportTicketDetail,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketView,
} from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  SupportAssignment,
  SupportCategory,
  SupportEscalation,
  SupportInternalNote,
  SupportMessage,
  SupportTicket,
} from "@prisma/client";
import { assertAdminRole, assertSupportAccess } from "../../common/auth/staff-auth";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";

type TicketRecord = SupportTicket & {
  category: SupportCategory;
  assignments: SupportAssignment[];
  messages: SupportMessage[];
};

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async listCategories(activeOnly: boolean): Promise<SupportCategoryView[]> {
    const rows = await this.prisma.supportCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((row) => this.toCategory(row));
  }

  async createCategory(
    actorId: string,
    roles: readonly MemberRole[],
    input: { name: string; slug?: string; isActive: boolean; sortOrder: number },
    requestId: string,
  ): Promise<SupportCategoryView> {
    assertAdminRole(roles);
    const slug = input.slug ?? slugify(input.name);
    const created = await this.prisma.supportCategory.create({
      data: { name: input.name, slug, isActive: input.isActive, sortOrder: input.sortOrder },
    });
    await this.audit.record({
      actorId,
      action: "SUPPORT_CATEGORY_CREATED",
      entity: "support_category",
      entityId: created.id,
      requestId,
      afterJson: { slug },
    });
    return this.toCategory(created);
  }

  async countOpen(): Promise<number> {
    return this.prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } });
  }

  async createTicket(
    memberId: string,
    input: { categoryId: string; subject: string; body: string },
    requestId: string,
  ): Promise<SupportTicketDetail> {
    const category = await this.prisma.supportCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (category === null || !category.isActive) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Support category is not available",
        HttpStatus.BAD_REQUEST,
      );
    }
    const created = await this.prisma.supportTicket.create({
      data: {
        memberId,
        categoryId: category.id,
        subject: input.subject,
        messages: { create: { authorMemberId: memberId, body: input.body, isInternal: false } },
      },
    });
    await this.audit.record({
      actorId: memberId,
      action: "SUPPORT_TICKET_OPENED",
      entity: "support_ticket",
      entityId: created.id,
      requestId,
      afterJson: { categorySlug: category.slug },
    });
    return this.getTicket(memberId, [], created.id);
  }

  async listMemberTickets(memberId: string): Promise<SupportTicketView[]> {
    const rows = await this.loadTicketRows({ memberId });
    return Promise.all(rows.map((row) => this.toTicketView(row)));
  }

  async listQueue(roles: readonly MemberRole[]): Promise<SupportTicketView[]> {
    assertSupportAccess(roles);
    const rows = await this.loadTicketRows({});
    return Promise.all(rows.map((row) => this.toTicketView(row)));
  }

  async getTicket(
    actorId: string,
    roles: readonly MemberRole[],
    ticketId: string,
  ): Promise<SupportTicketDetail> {
    const row = await this.requireTicket(ticketId);
    const staff = canAccessSupport(roles);
    if (!staff && row.memberId !== actorId) {
      throw new HasutHttpException("NOT_FOUND", "Ticket not found", HttpStatus.NOT_FOUND);
    }
    const [notes, escalations] = staff
      ? await Promise.all([
          this.prisma.supportInternalNote.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
          }),
          this.prisma.supportEscalation.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
          }),
        ])
      : [[], []];
    const messages = row.messages.filter((message) => staff || !message.isInternal);
    return {
      ...(await this.toTicketView(row)),
      messages: await Promise.all(messages.map((message) => this.toMessageView(message))),
      notes: await Promise.all(notes.map((note) => this.toNoteView(note))),
      escalations: await Promise.all(escalations.map((item) => this.toEscalationView(item))),
    };
  }

  async addMessage(
    actorId: string,
    roles: readonly MemberRole[],
    ticketId: string,
    body: string,
    requestId: string,
  ): Promise<SupportMessageView> {
    const row = await this.requireTicket(ticketId);
    const staff = canAccessSupport(roles);
    if (!staff && row.memberId !== actorId) {
      throw new HasutHttpException("NOT_FOUND", "Ticket not found", HttpStatus.NOT_FOUND);
    }
    if (row.status === "CLOSED") {
      throw new HasutHttpException("CONFLICT", "This ticket is closed", HttpStatus.CONFLICT);
    }
    const created = await this.prisma.supportMessage.create({
      data: { ticketId, authorMemberId: actorId, body, isInternal: false },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: staff ? "PENDING" : "OPEN" },
    });
    if (staff && row.memberId !== actorId) {
      await this.notifications.notify(row.memberId, "support.ticket.replied", {
        ticketId,
      });
    }
    await this.audit.record({
      actorId,
      action: "SUPPORT_MESSAGE_ADDED",
      entity: "support_ticket",
      entityId: ticketId,
      requestId,
    });
    return this.toMessageView(created);
  }

  async assign(
    actorId: string,
    roles: readonly MemberRole[],
    ticketId: string,
    assigneeId: string,
    requestId: string,
  ): Promise<SupportTicketView> {
    assertSupportAccess(roles);
    await this.requireTicket(ticketId);
    await this.requireStaffMember(assigneeId);
    await this.prisma.supportAssignment.create({
      data: { ticketId, assigneeId },
    });
    await this.audit.record({
      actorId,
      action: "SUPPORT_TICKET_ASSIGNED",
      entity: "support_ticket",
      entityId: ticketId,
      requestId,
      afterJson: { assigneeId },
    });
    const rows = await this.loadTicketRows({ id: ticketId });
    const next = rows[0];
    if (next === undefined) {
      throw new HasutHttpException("NOT_FOUND", "Ticket not found", HttpStatus.NOT_FOUND);
    }
    return this.toTicketView(next);
  }

  async addNote(
    actorId: string,
    roles: readonly MemberRole[],
    ticketId: string,
    body: string,
    requestId: string,
  ): Promise<SupportNoteView> {
    assertSupportAccess(roles);
    await this.requireTicket(ticketId);
    const created = await this.prisma.supportInternalNote.create({
      data: { ticketId, authorId: actorId, body },
    });
    await this.audit.record({
      actorId,
      action: "SUPPORT_NOTE_ADDED",
      entity: "support_ticket",
      entityId: ticketId,
      requestId,
    });
    return this.toNoteView(created);
  }

  async escalate(
    actorId: string,
    roles: readonly MemberRole[],
    ticketId: string,
    input: { toAssigneeId: string; reason: string },
    requestId: string,
  ): Promise<SupportEscalationView> {
    assertSupportAccess(roles);
    const row = await this.requireTicket(ticketId);
    await this.requireStaffMember(input.toAssigneeId);
    const current = row.assignments[0]?.assigneeId ?? null;
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.supportAssignment.create({
        data: { ticketId, assigneeId: input.toAssigneeId },
      });
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { priority: "HIGH", status: "OPEN" },
      });
      return tx.supportEscalation.create({
        data: {
          ticketId,
          fromAssigneeId: current,
          toAssigneeId: input.toAssigneeId,
          reason: input.reason,
        },
      });
    });
    await this.audit.record({
      actorId,
      action: "SUPPORT_TICKET_ESCALATED",
      entity: "support_ticket",
      entityId: ticketId,
      requestId,
      afterJson: { toAssigneeId: input.toAssigneeId },
    });
    return this.toEscalationView(created);
  }

  async patchTicket(
    actorId: string,
    roles: readonly MemberRole[],
    ticketId: string,
    input: { status?: SupportTicketStatus; priority?: SupportTicketPriority },
    requestId: string,
  ): Promise<SupportTicketView> {
    assertSupportAccess(roles);
    const row = await this.requireTicket(ticketId);
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: input.status ?? row.status,
        priority: input.priority ?? row.priority,
      },
    });
    if (input.status === "RESOLVED" || input.status === "CLOSED") {
      await this.notifications.notify(row.memberId, "support.ticket.resolved", { ticketId });
    }
    await this.audit.record({
      actorId,
      action: "SUPPORT_TICKET_UPDATED",
      entity: "support_ticket",
      entityId: ticketId,
      requestId,
      afterJson: { status: updated.status, priority: updated.priority },
    });
    const rows = await this.loadTicketRows({ id: ticketId });
    const next = rows[0];
    if (next === undefined) {
      throw new HasutHttpException("NOT_FOUND", "Ticket not found", HttpStatus.NOT_FOUND);
    }
    return this.toTicketView(next);
  }

  private async requireStaffMember(memberId: string): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { roles: true },
    });
    if (
      member === null ||
      !member.roles.some((row) => row.role === "ADMIN" || row.role === "SUPPORT_AGENT")
    ) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Assignee must be a support agent or admin",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async requireTicket(ticketId: string): Promise<TicketRecord> {
    const rows = await this.loadTicketRows({ id: ticketId });
    const row = rows[0];
    if (row === undefined) {
      throw new HasutHttpException("NOT_FOUND", "Ticket not found", HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async loadTicketRows(where: { id?: string; memberId?: string }): Promise<TicketRecord[]> {
    return this.prisma.supportTicket.findMany({
      where,
      include: {
        category: true,
        assignments: { orderBy: { assignedAt: "desc" }, take: 1 },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  private toCategory(row: SupportCategory): SupportCategoryView {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }

  private async toTicketView(row: TicketRecord): Promise<SupportTicketView> {
    const last = row.messages[row.messages.length - 1];
    const assigneeId = row.assignments[0]?.assigneeId ?? null;
    return {
      id: row.id,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      category: this.toCategory(row.category),
      member: await this.profiles.getPreview(row.memberId),
      assignee: assigneeId === null ? null : await this.profiles.getPreview(assigneeId),
      lastMessageAt: last === undefined ? null : last.createdAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toMessageView(row: SupportMessage): Promise<SupportMessageView> {
    return {
      id: row.id,
      ticketId: row.ticketId,
      author: await this.preview(row.authorMemberId),
      body: row.body,
      isInternal: row.isInternal,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async toNoteView(row: SupportInternalNote): Promise<SupportNoteView> {
    return {
      id: row.id,
      ticketId: row.ticketId,
      author: await this.preview(row.authorId),
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async toEscalationView(row: SupportEscalation): Promise<SupportEscalationView> {
    return {
      id: row.id,
      ticketId: row.ticketId,
      fromAssignee: row.fromAssigneeId === null ? null : await this.preview(row.fromAssigneeId),
      toAssignee: await this.preview(row.toAssigneeId),
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private preview(memberId: string): Promise<MemberPreview> {
    return this.profiles.getPreview(memberId);
  }
}

function canAccessSupport(roles: readonly MemberRole[]): boolean {
  return roles.includes("ADMIN") || roles.includes("SUPPORT_AGENT");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
