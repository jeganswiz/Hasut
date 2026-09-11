import type { IdentityVerificationRequest } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma, VerificationRequest } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
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

  private toIdentityView(row: VerificationRequest): IdentityVerificationRequest {
    return {
      id: row.id,
      type: "IDENTITY",
      status: this.requireRequestStatus(row.status),
      documentMediaIds: this.readDocumentIds(row.payloadJson),
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
