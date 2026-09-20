import type { ReviewAggregateView, ReviewView } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConnectionsService } from "../connections/connections.service";
import { ProfilesService } from "../profiles/profiles.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: ConnectionsService,
    private readonly profiles: ProfilesService,
    private readonly audit: AuditService,
  ) {}

  async list(subjectType: "PROFESSIONAL" | "BUSINESS", subjectId: string): Promise<ReviewView[]> {
    const rows = await this.prisma.review.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        subjectType: row.subjectType as "PROFESSIONAL" | "BUSINESS",
        subjectId: row.subjectId,
        rating: row.rating,
        body: row.body,
        author: await this.profiles.getPreview(row.authorId),
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  async aggregate(
    subjectType: "PROFESSIONAL" | "BUSINESS",
    subjectId: string,
  ): Promise<ReviewAggregateView> {
    const row = await this.prisma.reviewAggregate.findUnique({
      where: { subjectType_subjectId: { subjectType, subjectId } },
    });
    return { avgRating: row?.avgRating ?? 0, count: row?.count ?? 0 };
  }

  async create(
    authorId: string,
    input: {
      subjectType: "PROFESSIONAL" | "BUSINESS";
      subjectId: string;
      rating: number;
      body: string;
    },
    requestId: string,
  ): Promise<ReviewView> {
    const ownerId = await this.ownerMemberId(input.subjectType, input.subjectId);
    if (ownerId === authorId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You cannot review yourself",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.connections.requireAcceptedPair(authorId, ownerId);
    const created = await this.prisma.review.create({
      data: {
        authorId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        rating: input.rating,
        body: input.body,
      },
    });
    await this.recompute(input.subjectType, input.subjectId);
    await this.audit.record({
      actorId: authorId,
      action: "REVIEW_CREATED",
      entity: "review",
      entityId: created.id,
      requestId,
      afterJson: { rating: input.rating, subjectType: input.subjectType },
    });
    return {
      id: created.id,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      rating: created.rating,
      body: created.body,
      author: await this.profiles.getPreview(authorId),
      createdAt: created.createdAt.toISOString(),
    };
  }

  private async ownerMemberId(
    subjectType: "PROFESSIONAL" | "BUSINESS",
    subjectId: string,
  ): Promise<string> {
    if (subjectType === "PROFESSIONAL") {
      const row = await this.prisma.professionalProfile.findUnique({ where: { id: subjectId } });
      if (row === null) {
        throw new HasutHttpException("NOT_FOUND", "Professional not found", HttpStatus.NOT_FOUND);
      }
      return row.memberId;
    }
    const row = await this.prisma.business.findUnique({ where: { id: subjectId } });
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Business not found", HttpStatus.NOT_FOUND);
    }
    return row.ownerMemberId;
  }

  private async recompute(
    subjectType: "PROFESSIONAL" | "BUSINESS",
    subjectId: string,
  ): Promise<void> {
    const stats = await this.prisma.review.aggregate({
      where: { subjectType, subjectId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.reviewAggregate.upsert({
      where: { subjectType_subjectId: { subjectType, subjectId } },
      create: {
        subjectType,
        subjectId,
        avgRating: stats._avg.rating ?? 0,
        count: stats._count._all,
      },
      update: {
        avgRating: stats._avg.rating ?? 0,
        count: stats._count._all,
      },
    });
  }
}
