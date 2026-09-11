import type { BlockView, ReportView } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly profiles: ProfilesService,
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
    return {
      id: created.id,
      targetType: created.targetType,
      targetId: created.targetId,
      reasonCode: created.reasonCode,
      details: created.details,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
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
