import type {
  AdminProfessionalView,
  MemberRole,
  OnboardingStatus,
  OnboardingSteps,
  OwnerProfessional,
  OwnerServiceArea,
  ProfessionalOnboarding,
  ProfessionalSkillView,
  PublicProfessional,
  PublicServiceArea,
} from "@hasut/types";
import { isValidWgs84 } from "@hasut/utils";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  Category,
  ProfessionalCategory,
  ProfessionalProfile,
  ProfessionalSkill,
  ServiceArea,
} from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { assertAdminRole } from "../../common/auth/staff-auth";
import { AuditService } from "../audit/audit.service";
import { CategoriesService } from "../categories/categories.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { REVERSE_GEOCODER, type ReverseGeocoder } from "../locations/geocoder/reverse-geocoder";
import { LocationsRepository } from "../locations/locations.repository";
import { PrismaService } from "../prisma/prisma.service";

type LoadedProfessional = ProfessionalProfile & {
  categories: Array<ProfessionalCategory & { category: Category }>;
  skills: ProfessionalSkill[];
  serviceArea: ServiceArea | null;
};

const professionalInclude = {
  categories: { include: { category: true }, orderBy: { category: { sortOrder: "asc" as const } } },
  skills: { orderBy: { label: "asc" as const } },
  serviceArea: true,
};

@Injectable()
export class ProfessionalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly categories: CategoriesService,
    private readonly locations: LocationsRepository,
    private readonly audit: AuditService,
    @Inject(REVERSE_GEOCODER) private readonly geocoder: ReverseGeocoder,
  ) {}

  async getOnboarding(memberId: string): Promise<ProfessionalOnboarding> {
    const [professional, catalog, availabilities, policy] = await Promise.all([
      this.findOwner(memberId),
      this.categories.listPublic("PROFESSIONAL"),
      this.configuration.getProfessionalAvailabilities(),
      this.configuration.getLocationPolicy(),
    ]);
    return {
      status: this.onboardingStatus(professional),
      steps: this.steps(professional),
      professional,
      categories: catalog,
      availabilities,
      serviceAreaRadius: {
        minMeters: policy.serviceAreaMinRadiusMeters,
        maxMeters: policy.serviceAreaMaxRadiusMeters,
      },
    };
  }

  async start(memberId: string, requestId: string): Promise<ProfessionalOnboarding> {
    const existing = await this.prisma.professionalProfile.findUnique({ where: { memberId } });
    if (existing === null) {
      await this.prisma.professionalProfile.create({
        data: { memberId, status: "DRAFT" },
      });
      await this.audit.record({
        actorId: memberId,
        action: "PROFESSIONAL_ONBOARDING_STARTED",
        entity: "professional_profile",
        entityId: memberId,
        requestId,
      });
    }
    return this.getOnboarding(memberId);
  }

  async saveCategories(
    memberId: string,
    categoryIds: string[],
    requestId: string,
  ): Promise<ProfessionalOnboarding> {
    const profile = await this.requireDraftable(memberId);
    await this.categories.requireAssignable(categoryIds);
    await this.prisma.$transaction([
      this.prisma.professionalCategory.deleteMany({
        where: { professionalProfileId: profile.id },
      }),
      this.prisma.professionalCategory.createMany({
        data: categoryIds.map((categoryId) => ({
          professionalProfileId: profile.id,
          categoryId,
        })),
      }),
    ]);
    await this.audit.record({
      actorId: memberId,
      action: "PROFESSIONAL_CATEGORIES_UPDATED",
      entity: "professional_profile",
      entityId: profile.id,
      requestId,
      afterJson: { categoryCount: categoryIds.length },
    });
    return this.getOnboarding(memberId);
  }

  async saveProfile(
    memberId: string,
    input: {
      headline: string;
      experienceYears: number;
      availability: string;
      skills: Array<{ label: string; categoryId?: string | null }>;
    },
    requestId: string,
  ): Promise<ProfessionalOnboarding> {
    const profile = await this.requireDraftable(memberId);
    await this.assertAvailability(input.availability);
    const skillCategoryIds = input.skills
      .map((skill) => skill.categoryId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (skillCategoryIds.length > 0) {
      await this.categories.requireAssignable(skillCategoryIds);
    }

    await this.prisma.$transaction([
      this.prisma.professionalProfile.update({
        where: { id: profile.id },
        data: {
          headline: input.headline,
          experienceYears: input.experienceYears,
          availability: input.availability,
        },
      }),
      this.prisma.professionalSkill.deleteMany({ where: { professionalProfileId: profile.id } }),
      ...input.skills.map((skill) =>
        this.prisma.professionalSkill.create({
          data: {
            professionalProfileId: profile.id,
            label: skill.label,
            categoryId: skill.categoryId ?? null,
          },
        }),
      ),
    ]);
    await this.audit.record({
      actorId: memberId,
      action: "PROFESSIONAL_PROFILE_UPDATED",
      entity: "professional_profile",
      entityId: profile.id,
      requestId,
      afterJson: { experienceYears: input.experienceYears, skillCount: input.skills.length },
    });
    return this.getOnboarding(memberId);
  }

  async saveServiceArea(
    memberId: string,
    input: { latitude: number; longitude: number; radiusMeters: number },
    requestId: string,
  ): Promise<ProfessionalOnboarding> {
    if (!isValidWgs84(input.latitude, input.longitude)) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Coordinates are invalid",
        HttpStatus.BAD_REQUEST,
      );
    }
    const profile = await this.requireDraftable(memberId);
    const policy = await this.configuration.getLocationPolicy();
    if (
      input.radiusMeters < policy.serviceAreaMinRadiusMeters ||
      input.radiusMeters > policy.serviceAreaMaxRadiusMeters
    ) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Service area radius is outside the configured range",
        HttpStatus.BAD_REQUEST,
      );
    }

    const resolved = (await this.geocoder.reverse({
      latitude: input.latitude,
      longitude: input.longitude,
    })) ?? {
      label: "Service area",
      city: null,
      region: null,
      country: null,
      countryCode: null,
    };

    await this.prisma.serviceArea.upsert({
      where: { professionalProfileId: profile.id },
      create: {
        professionalProfileId: profile.id,
        radiusMeters: input.radiusMeters,
        label: resolved.label,
        city: resolved.city,
        region: resolved.region,
        country: resolved.country,
        countryCode: resolved.countryCode,
      },
      update: {
        radiusMeters: input.radiusMeters,
        label: resolved.label,
        city: resolved.city,
        region: resolved.region,
        country: resolved.country,
        countryCode: resolved.countryCode,
      },
    });
    await this.locations.writeServiceAreaCenter(profile.id, input.longitude, input.latitude);
    await this.audit.record({
      actorId: memberId,
      action: "PROFESSIONAL_SERVICE_AREA_UPDATED",
      entity: "service_area",
      entityId: profile.id,
      requestId,
      afterJson: {
        radiusMeters: input.radiusMeters,
        city: resolved.city,
        country: resolved.country,
      },
    });
    return this.getOnboarding(memberId);
  }

  async submit(memberId: string, requestId: string): Promise<ProfessionalOnboarding> {
    const profile = await this.requireDraftable(memberId);
    const loaded = await this.loadById(profile.id);
    const steps = this.steps(loaded === null ? null : await this.toOwner(loaded));
    if (!steps.categories || !steps.profile || !steps.serviceArea) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Select categories, add professional information, and set a service area before submitting",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.professionalProfile.update({
      where: { id: profile.id },
      data: {
        status: "ACTIVE",
        submittedAt: profile.submittedAt ?? new Date(),
      },
    });
    await this.audit.record({
      actorId: memberId,
      action: "PROFESSIONAL_ONBOARDING_SUBMITTED",
      entity: "professional_profile",
      entityId: profile.id,
      requestId,
    });
    return this.getOnboarding(memberId);
  }

  async getMine(memberId: string): Promise<OwnerProfessional> {
    const professional = await this.findOwner(memberId);
    if (professional === null) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "Professional profile not found",
        HttpStatus.NOT_FOUND,
      );
    }
    return professional;
  }

  async patchStatus(
    memberId: string,
    status: "ACTIVE" | "PAUSED",
    requestId: string,
  ): Promise<OwnerProfessional> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { memberId } });
    if (profile === null || profile.status === "DRAFT") {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Submit professional onboarding before changing status",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.professionalProfile.update({
      where: { id: profile.id },
      data: { status },
    });
    await this.audit.record({
      actorId: memberId,
      action: "PROFESSIONAL_STATUS_CHANGED",
      entity: "professional_profile",
      entityId: profile.id,
      requestId,
      afterJson: { status },
    });
    return this.getMine(memberId);
  }

  async listAdmin(roles: readonly MemberRole[]): Promise<AdminProfessionalView[]> {
    assertAdminRole(roles);
    const rows = await this.prisma.professionalProfile.findMany({
      include: { member: { include: { profile: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      displayName: row.member.profile?.displayName || "Member",
      headline: row.headline,
      status: row.status,
      identityVerificationStatus: row.identityVerificationStatus,
    }));
  }

  async getPublic(professionalId: string): Promise<PublicProfessional> {
    const loaded = await this.loadById(professionalId);
    if (loaded === null || loaded.status !== "ACTIVE") {
      throw new HasutHttpException("NOT_FOUND", "Professional not found", HttpStatus.NOT_FOUND);
    }
    return this.toPublic(loaded);
  }

  private async findOwner(memberId: string): Promise<OwnerProfessional | null> {
    const loaded = await this.prisma.professionalProfile.findUnique({
      where: { memberId },
      include: professionalInclude,
    });
    if (loaded === null) {
      return null;
    }
    return this.toOwner(loaded);
  }

  private async loadById(professionalId: string): Promise<LoadedProfessional | null> {
    return this.prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      include: professionalInclude,
    });
  }

  private async requireDraftable(memberId: string): Promise<ProfessionalProfile> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { memberId } });
    if (profile === null) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Start professional onboarding first",
        HttpStatus.BAD_REQUEST,
      );
    }
    return profile;
  }

  private async assertAvailability(code: string): Promise<void> {
    const options = await this.configuration.getProfessionalAvailabilities();
    if (!options.some((option) => option.code === code)) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Availability is not a configured option",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private onboardingStatus(professional: OwnerProfessional | null): OnboardingStatus {
    if (professional === null) {
      return "NOT_STARTED";
    }
    return professional.status;
  }

  private steps(professional: OwnerProfessional | null): OnboardingSteps {
    if (professional === null) {
      return { categories: false, profile: false, serviceArea: false, submitted: false };
    }
    return {
      categories: professional.categories.length > 0,
      profile: professional.availability.length > 0,
      serviceArea: professional.serviceArea !== null,
      submitted: professional.status !== "DRAFT",
    };
  }

  private async toOwner(row: LoadedProfessional): Promise<OwnerProfessional> {
    const center =
      row.serviceArea === null ? null : await this.locations.readServiceAreaCenter(row.id);
    return {
      ...this.toPublic(row),
      serviceArea: this.toOwnerServiceArea(row.serviceArea, center),
    };
  }

  private toPublic(row: LoadedProfessional): PublicProfessional {
    return {
      id: row.id,
      memberId: row.memberId,
      headline: row.headline,
      experienceYears: row.experienceYears,
      availability: row.availability,
      status: row.status,
      identityVerificationStatus: row.identityVerificationStatus,
      skillVerificationStatus: row.skillVerificationStatus,
      categories: row.categories.map((item) => ({
        id: item.category.id,
        name: item.category.name,
        slug: item.category.slug,
      })),
      skills: row.skills.map((skill): ProfessionalSkillView => ({
        id: skill.id,
        label: skill.label,
        categoryId: skill.categoryId,
      })),
      serviceArea: this.toPublicServiceArea(row.serviceArea),
    };
  }

  private toPublicServiceArea(row: ServiceArea | null): PublicServiceArea | null {
    if (row === null) {
      return null;
    }
    return {
      label: row.label,
      city: row.city,
      region: row.region,
      country: row.country,
      countryCode: row.countryCode,
      radiusMeters: row.radiusMeters,
    };
  }

  private toOwnerServiceArea(
    row: ServiceArea | null,
    center: { latitude: number; longitude: number } | null,
  ): OwnerServiceArea | null {
    const publicArea = this.toPublicServiceArea(row);
    if (publicArea === null || center === null) {
      return publicArea === null ? null : { ...publicArea, latitude: 0, longitude: 0 };
    }
    return {
      ...publicArea,
      latitude: center.latitude,
      longitude: center.longitude,
    };
  }
}
