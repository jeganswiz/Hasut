import type { AdminReportView, BlockView, MemberRole, ReportView } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { assertModerationAccess } from "../../common/auth/staff-auth";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly profiles: ProfilesService,
    private readonly audit: AuditService,
  ) {}

  async isBlockedEitherWay(memberA: string, memberB: string): Promise<boolean> {
    const row = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: memberA, blockedId: memberB },
          { blockerId: memberB, blockedId: memberA },
        ],
      },
    });
    return row !== null;
  }

  async assertNotBlocked(actorId: string, otherId: string): Promise<void> {
    if (await this.isBlockedEitherWay(actorId, otherId)) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "You cannot interact with this member",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async block(actorId: string, memberId: string): Promise<BlockView> {
    if (actorId === memberId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You cannot block yourself",
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: actorId, blockedId: memberId } },
    });
    if (existing !== null) {
      return this.toBlockView(existing);
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.block.create({
        data: { blockerId: actorId, blockedId: memberId },
      });
      await tx.connection.updateMany({
        where: {
          status: "PENDING",
          OR: [
            { requesterId: actorId, addresseeId: memberId },
            { requesterId: memberId, addresseeId: actorId },
          ],
        },
        data: { status: "CANCELLED" },
      });
      return row;
    });
    return this.toBlockView(created);
  }

  async unblock(actorId: string, memberId: string): Promise<{ removed: boolean }> {
    const result = await this.prisma.block.deleteMany({
      where: { blockerId: actorId, blockedId: memberId },
    });
    return { removed: result.count > 0 };
  }

  async listBlocks(actorId: string): Promise<BlockView[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: actorId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(rows.map((row) => this.toBlockView(row)));
  }

  async createReport(
    actorId: string,
    input: {
      targetType: ReportView["targetType"];
      targetId: string;
      reasonCode: string;
      details: string;
    },
  ): Promise<ReportView> {
    const policy = await this.configuration.getReportsPolicy();
    if (!policy.reasonCodes.some((reason) => reason.code === input.reasonCode)) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Report reason is not allowed",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.targetType === "MEMBER" && input.targetId === actorId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You cannot report yourself",
        HttpStatus.BAD_REQUEST,
      );
    }
    const created = await this.prisma.report.create({
      data: {
        reporterId: actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        reasonCode: input.reasonCode,
        details: input.details,
      },
    });
    return this.toMemberReport(created);
  }

  async countOpen(): Promise<number> {
    return this.prisma.report.count({ where: { status: "OPEN" } });
  }

  async listQueue(roles: readonly MemberRole[]): Promise<AdminReportView[]> {
    assertModerationAccess(roles);
    const rows = await this.prisma.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return Promise.all(rows.map((row) => this.toAdminReport(row)));
  }

  async moderate(
    actorId: string,
    roles: readonly MemberRole[],
    reportId: string,
    action: "HIDE" | "DISMISS",
    requestId: string,
  ): Promise<AdminReportView> {
    assertModerationAccess(roles);
    const row = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Report not found", HttpStatus.NOT_FOUND);
    }
    if (row.status !== "OPEN") {
      throw new HasutHttpException(
        "CONFLICT",
        "This report is already resolved",
        HttpStatus.CONFLICT,
      );
    }

    let hidden = false;
    if (action === "HIDE") {
      hidden = await this.hideTarget(row.targetType, row.targetId);
    }

    const updated = await this.prisma.report.update({
      where: { id: row.id },
      data: { status: action === "HIDE" ? "ACTIONED" : "DISMISSED" },
    });
    await this.prisma.moderationAction.create({
      data: {
        reportId: row.id,
        actorId,
        action: action === "HIDE" ? "HIDE" : "DISMISS",
        entityType: row.targetType,
        entityId: row.targetId,
      },
    });
    await this.audit.record({
      actorId,
      action: action === "HIDE" ? "REPORT_CONTENT_HIDDEN" : "REPORT_DISMISSED",
      entity: "report",
      entityId: row.id,
      requestId,
      afterJson: { targetType: row.targetType, hidden },
    });
    return this.toAdminReport(updated, hidden);
  }

  private async hideTarget(
    targetType: ReportView["targetType"],
    targetId: string,
  ): Promise<boolean> {
    if (targetType === "MEMBER" || targetType === "PROFILE") {
      await this.prisma.profile.updateMany({
        where: { memberId: targetId },
        data: { isDiscoverable: false },
      });
      return true;
    }
    if (targetType === "MESSAGE") {
      const result = await this.prisma.message.updateMany({
        where: { id: targetId, hiddenAt: null },
        data: { hiddenAt: new Date() },
      });
      return result.count > 0;
    }
    if (targetType === "BUSINESS") {
      const result = await this.prisma.business.updateMany({
        where: { id: targetId },
        data: { status: "PAUSED" },
      });
      return result.count > 0;
    }
    return false;
  }

  private toMemberReport(row: {
    id: string;
    targetType: ReportView["targetType"];
    targetId: string;
    reasonCode: string;
    details: string;
    status: ReportView["status"];
    createdAt: Date;
  }): ReportView {
    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      reasonCode: row.reasonCode,
      details: row.details,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async toAdminReport(
    row: {
      id: string;
      reporterId: string;
      targetType: ReportView["targetType"];
      targetId: string;
      reasonCode: string;
      details: string;
      status: ReportView["status"];
      createdAt: Date;
    },
    hidden?: boolean,
  ): Promise<AdminReportView> {
    const hideRow =
      hidden ??
      (await this.prisma.moderationAction.findFirst({
        where: { reportId: row.id, action: "HIDE" },
      }));
    return {
      ...this.toMemberReport(row),
      reporter: await this.profiles.getPreview(row.reporterId),
      hidden: typeof hideRow === "boolean" ? hideRow : hideRow !== null,
    };
  }

  private async toBlockView(row: {
    id: string;
    blockedId: string;
    createdAt: Date;
  }): Promise<BlockView> {
    return {
      id: row.id,
      member: await this.profiles.getPreview(row.blockedId),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
