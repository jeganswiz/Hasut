import type { AdminBusinessView, MemberRole, PublicBusiness } from "@hasut/types";
import { isValidWgs84 } from "@hasut/utils";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { assertAdminRole } from "../../common/auth/staff-auth";
import { AuditService } from "../audit/audit.service";
import { REVERSE_GEOCODER, type ReverseGeocoder } from "../locations/geocoder/reverse-geocoder";
import { LocationsRepository } from "../locations/locations.repository";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsRepository,
    private readonly audit: AuditService,
    @Inject(REVERSE_GEOCODER) private readonly geocoder: ReverseGeocoder,
  ) {}

  async create(
    memberId: string,
    input: {
      name: string;
      description: string;
      categoryIds: string[];
      latitude: number;
      longitude: number;
    },
    requestId: string,
  ): Promise<PublicBusiness> {
    if (!isValidWgs84(input.latitude, input.longitude)) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Coordinates are invalid",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.requireBusinessCategories(input.categoryIds);
    const resolved = (await this.geocoder.reverse({
      latitude: input.latitude,
      longitude: input.longitude,
    })) ?? {
      label: "Business area",
      city: null,
      region: null,
      country: null,
      countryCode: null,
    };
    const created = await this.prisma.business.create({
      data: {
        ownerMemberId: memberId,
        name: input.name,
        description: input.description,
        status: "ACTIVE",
        categories: {
          createMany: { data: input.categoryIds.map((categoryId) => ({ categoryId })) },
        },
        location: {
          create: {
            label: resolved.label,
            city: resolved.city,
            region: resolved.region,
            country: resolved.country,
            countryCode: resolved.countryCode,
            isPublic: true,
          },
        },
      },
    });
    await this.locations.writeBusinessPoint(created.id, input.longitude, input.latitude);
    await this.audit.record({
      actorId: memberId,
      action: "BUSINESS_CREATED",
      entity: "business",
      entityId: created.id,
      requestId,
      afterJson: { name: created.name },
    });
    return this.getPublic(created.id);
  }

  async getPublic(businessId: string): Promise<PublicBusiness> {
    const row = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { categories: { include: { category: true } }, location: true },
    });
    if (row === null || row.status !== "ACTIVE") {
      throw new HasutHttpException("NOT_FOUND", "Business not found", HttpStatus.NOT_FOUND);
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      verificationStatus: row.verificationStatus,
      categories: row.categories.map((item) => ({
        id: item.category.id,
        name: item.category.name,
        slug: item.category.slug,
      })),
      approximateLocation:
        row.location === null
          ? null
          : {
              label: row.location.label,
              city: row.location.city,
              region: row.location.region,
              country: row.location.country,
              countryCode: row.location.countryCode,
            },
    };
  }

  async listAdmin(roles: readonly MemberRole[]): Promise<AdminBusinessView[]> {
    assertAdminRole(roles);
    const rows = await this.prisma.business.findMany({
      include: { owner: { include: { profile: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      ownerDisplayName: row.owner.profile?.displayName || "Member",
    }));
  }

  private async requireBusinessCategories(categoryIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(categoryIds)];
    const rows = await this.prisma.category.findMany({
      where: { id: { in: uniqueIds }, isActive: true, appliesTo: { in: ["BUSINESS", "ALL"] } },
    });
    if (rows.length !== uniqueIds.length) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "One or more categories are invalid for businesses",
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
