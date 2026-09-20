import type {
  AdminVerificationRequest,
  IdentityVerificationRequest,
  MemberRole,
  VerificationDecision,
} from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma, VerificationRequest } from "@prisma/client";
import { assertAdminRole } from "../../common/auth/staff-auth";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { MediaService } from "../media/media.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly profiles: ProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  async requestIdentity(
    memberId: string,
    documentMediaIds: string[],
    requestId: string,
  ): Promise<IdentityVerificationRequest> {
    await this.media.requireReadyVerification(memberId, documentMediaIds);

    const open = await this.prisma.verificationRequest.findFirst({
      where: { memberId, type: "IDENTITY", status: { in: ["PENDING", "UNDER_REVIEW"] } },
    });
    if (open !== null) {
      throw new HasutHttpException(
        "CONFLICT",
        "An identity verification request is already open",
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.verificationRequest.create({
      data: {
        memberId,
        type: "IDENTITY",
        status: "PENDING",
        payloadJson: { documentMediaIds },
      },
    });

    const professional = await this.prisma.professionalProfile.findUnique({
      where: { memberId },
    });
    if (professional !== null) {
      await this.prisma.professionalProfile.update({
        where: { id: professional.id },
        data: { identityVerificationStatus: "PENDING" },
      });
    }

    await this.audit.record({
      actorId: memberId,
      action: "IDENTITY_VERIFICATION_REQUESTED",
      entity: "verification_request",
      entityId: created.id,
      requestId,
      afterJson: { documentCount: documentMediaIds.length },
    });
    return this.toIdentityView(created);
  }

  async getIdentity(memberId: string): Promise<IdentityVerificationRequest> {
    const row = await this.prisma.verificationRequest.findFirst({
      where: { memberId, type: "IDENTITY" },
      orderBy: { createdAt: "desc" },
    });
    if (row === null) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "Identity verification request not found",
        HttpStatus.NOT_FOUND,
      );
    }
    return this.toIdentityView(row);
  }

  async countPending(): Promise<number> {
    return this.prisma.verificationRequest.count({
      where: { type: "IDENTITY", status: { in: ["PENDING", "UNDER_REVIEW"] } },
    });
  }

  async listQueue(roles: readonly MemberRole[]): Promise<AdminVerificationRequest[]> {
    assertAdminRole(roles);
    const rows = await this.prisma.verificationRequest.findMany({
      where: { type: "IDENTITY", status: { in: ["PENDING", "UNDER_REVIEW"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return Promise.all(rows.map((row) => this.toAdminView(row)));
  }

  async decide(
    actorId: string,
    roles: readonly MemberRole[],
    requestIdParam: string,
    input: { decision: VerificationDecision; reviewNote: string },
    requestId: string,
  ): Promise<AdminVerificationRequest> {
    assertAdminRole(roles);
    const row = await this.prisma.verificationRequest.findUnique({
      where: { id: requestIdParam },
    });
    if (row === null || row.type !== "IDENTITY") {
      throw new HasutHttpException(
        "NOT_FOUND",
        "Identity verification request not found",
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== "PENDING" && row.status !== "UNDER_REVIEW") {
      throw new HasutHttpException(
        "CONFLICT",
        "This identity verification request is already decided",
        HttpStatus.CONFLICT,
      );
    }

    const nextStatus = input.decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    const decided = await this.prisma.verificationRequest.update({
      where: { id: row.id },
      data: {
        status: nextStatus,
        reviewerId: actorId,
        reviewNote: input.reviewNote.length > 0 ? input.reviewNote : null,
        decidedAt: new Date(),
      },
    });

    const professional = await this.prisma.professionalProfile.findUnique({
      where: { memberId: row.memberId },
    });
    if (professional !== null) {
      await this.prisma.professionalProfile.update({
        where: { id: professional.id },
        data: { identityVerificationStatus: nextStatus },
      });
    }

    await this.notifications.notify(
      row.memberId,
      input.decision === "APPROVE" ? "verification.approved" : "verification.rejected",
      { outcome: nextStatus },
    );

    await this.audit.record({
      actorId,
      action:
        input.decision === "APPROVE"
          ? "IDENTITY_VERIFICATION_APPROVED"
          : "IDENTITY_VERIFICATION_REJECTED",
      entity: "verification_request",
      entityId: row.id,
      requestId,
      beforeJson: { status: row.status },
      afterJson: { status: nextStatus, hasReviewNote: input.reviewNote.length > 0 },
    });
    return this.toAdminView(decided);
  }

  private async toAdminView(row: VerificationRequest): Promise<AdminVerificationRequest> {
    return {
      ...this.toIdentityView(row),
      member: await this.profiles.getPreview(row.memberId),
    };
  }

  private toIdentityView(row: VerificationRequest): IdentityVerificationRequest {
    return {
      id: row.id,
      type: "IDENTITY",
      status: this.requireRequestStatus(row.status),
      documentMediaIds: this.readDocumentIds(row.payloadJson),
      reviewNote: row.reviewNote,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
    };
  }

  private requireRequestStatus(
    status: VerificationRequest["status"],
  ): IdentityVerificationRequest["status"] {
    if (status === "NOT_STARTED") {
      throw new HasutHttpException(
        "INTERNAL_ERROR",
        "Identity request is missing a review status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return status;
  }

  private readDocumentIds(payload: Prisma.JsonValue): string[] {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return [];
    }
    const ids = (payload as { documentMediaIds?: unknown }).documentMediaIds;
    if (!Array.isArray(ids)) {
      return [];
    }
    return ids.filter((id): id is string => typeof id === "string");
  }
}
