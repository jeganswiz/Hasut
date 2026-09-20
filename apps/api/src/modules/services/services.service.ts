import { HttpStatus, Injectable } from "@nestjs/common";
import type { MemberRole, ServiceOfferingView } from "@hasut/types";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listMine(memberId: string): Promise<ServiceOfferingView[]> {
    const professional = await this.requireProfessional(memberId);
    const rows = await this.prisma.serviceOffering.findMany({
      where: { professionalProfileId: professional.id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toView(row));
  }

  async listPublic(professionalId: string): Promise<ServiceOfferingView[]> {
    const rows = await this.prisma.serviceOffering.findMany({
      where: { professionalProfileId: professionalId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    memberId: string,
    input: {
      categoryId: string;
      title: string;
      description: string;
      displayPriceAmount?: number | null;
      displayCurrency?: string | null;
    },
    requestId: string,
  ): Promise<ServiceOfferingView> {
    const professional = await this.requireProfessional(memberId);
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (category === null || !category.isActive) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Category is invalid",
        HttpStatus.BAD_REQUEST,
      );
    }
    const created = await this.prisma.serviceOffering.create({
      data: {
        professionalProfileId: professional.id,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        displayPriceAmount: input.displayPriceAmount ?? null,
        displayCurrency: input.displayCurrency ?? null,
      },
    });
    await this.audit.record({
      actorId: memberId,
      action: "SERVICE_OFFERING_CREATED",
      entity: "service_offering",
      entityId: created.id,
      requestId,
    });
    return this.toView(created);
  }

  async remove(
    memberId: string,
    offeringId: string,
    roles: readonly MemberRole[],
    requestId: string,
  ): Promise<void> {
    const offering = await this.prisma.serviceOffering.findUnique({
      where: { id: offeringId },
      include: { professional: true },
    });
    if (offering === null) {
      throw new HasutHttpException("NOT_FOUND", "Service offering not found", HttpStatus.NOT_FOUND);
    }
    if (offering.professional.memberId !== memberId && !roles.includes("ADMIN")) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "You cannot remove this offering",
        HttpStatus.FORBIDDEN,
      );
    }
    await this.prisma.serviceOffering.update({
      where: { id: offeringId },
      data: { isActive: false },
    });
    await this.audit.record({
      actorId: memberId,
      action: "SERVICE_OFFERING_PAUSED",
      entity: "service_offering",
      entityId: offeringId,
      requestId,
    });
  }

  private async requireProfessional(memberId: string) {
    const professional = await this.prisma.professionalProfile.findUnique({ where: { memberId } });
    if (professional === null) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "Start professional onboarding first",
        HttpStatus.NOT_FOUND,
      );
    }
    return professional;
  }

  private toView(row: {
    id: string;
    professionalProfileId: string;
    categoryId: string;
    title: string;
    description: string;
    displayPriceAmount: { toNumber(): number } | number | null;
    displayCurrency: string | null;
    isActive: boolean;
  }): ServiceOfferingView {
    const amount =
      row.displayPriceAmount === null
        ? null
        : typeof row.displayPriceAmount === "number"
          ? row.displayPriceAmount
          : row.displayPriceAmount.toNumber();
    return {
      id: row.id,
      professionalId: row.professionalProfileId,
      categoryId: row.categoryId,
      title: row.title,
      description: row.description,
      displayPriceAmount: amount,
      displayCurrency: row.displayCurrency,
      isActive: row.isActive,
    };
  }
}
