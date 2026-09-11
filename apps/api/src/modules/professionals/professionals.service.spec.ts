import { LOCATION_POLICY_DEFAULTS, PROFESSIONAL_AVAILABILITY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { containsExactCoordinateKeys } from "@hasut/utils";
import { AuditService } from "../audit/audit.service";
import { CategoriesService } from "../categories/categories.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { REVERSE_GEOCODER } from "../locations/geocoder/reverse-geocoder";
import { LocationsRepository } from "../locations/locations.repository";
import { PrismaService } from "../prisma/prisma.service";
import { ProfessionalsService } from "./professionals.service";

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const CATEGORY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CATEGORY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function loadedProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    memberId: MEMBER_ID,
    headline: "Plumber nearby",
    experienceYears: 6,
    availability: "AVAILABLE",
    status: "DRAFT",
    identityVerificationStatus: "NOT_STARTED",
    skillVerificationStatus: "NOT_STARTED",
    submittedAt: null,
    categories: [
      { category: { id: CATEGORY_A, name: "Parent", slug: "parent" } },
      { category: { id: CATEGORY_B, name: "Child", slug: "child" } },
    ],
    skills: [{ id: "skill-1", label: "Leak repair", categoryId: CATEGORY_B }],
    serviceArea: {
      label: "Bengaluru, Karnataka, India",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
      radiusMeters: 5000,
    },
    ...overrides,
  };
}

describe("ProfessionalsService", () => {
  const prisma = {
    professionalProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    professionalCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
    professionalSkill: { deleteMany: jest.fn(), create: jest.fn() },
    serviceArea: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  const configuration = {
    getProfessionalAvailabilities: jest.fn(),
    getLocationPolicy: jest.fn(),
  };
  const categories = {
    listPublic: jest.fn(),
    requireAssignable: jest.fn(),
  };
  const locations = {
    writeServiceAreaCenter: jest.fn(),
    readServiceAreaCenter: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const geocoder = { reverse: jest.fn() };

  async function createService(): Promise<ProfessionalsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfessionalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigurationService, useValue: configuration },
        { provide: CategoriesService, useValue: categories },
        { provide: LocationsRepository, useValue: locations },
        { provide: AuditService, useValue: audit },
        { provide: REVERSE_GEOCODER, useValue: geocoder },
      ],
    }).compile();
    return moduleRef.get(ProfessionalsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getProfessionalAvailabilities.mockResolvedValue(
      PROFESSIONAL_AVAILABILITY_DEFAULTS,
    );
    configuration.getLocationPolicy.mockResolvedValue(LOCATION_POLICY_DEFAULTS);
    categories.listPublic.mockResolvedValue([]);
    categories.requireAssignable.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    locations.readServiceAreaCenter.mockResolvedValue({ latitude: 12.97, longitude: 77.59 });
    locations.writeServiceAreaCenter.mockResolvedValue(undefined);
    geocoder.reverse.mockResolvedValue({
      label: "Bengaluru, Karnataka, India",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
    });
    prisma.$transaction.mockImplementation(async (ops: unknown) => ops);
    prisma.professionalCategory.deleteMany.mockResolvedValue({ count: 0 });
    prisma.professionalCategory.createMany.mockResolvedValue({ count: 2 });
    prisma.professionalSkill.deleteMany.mockResolvedValue({ count: 0 });
    prisma.professionalSkill.create.mockResolvedValue({});
    prisma.serviceArea.upsert.mockResolvedValue({});
    prisma.professionalProfile.update.mockResolvedValue({});
  });

  it("submits professional onboarding after categories, profile, and service area", async () => {
    const draft = loadedProfile();
    prisma.professionalProfile.findUnique
      .mockResolvedValueOnce({
        id: PROFILE_ID,
        memberId: MEMBER_ID,
        submittedAt: null,
        status: "DRAFT",
      })
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(
        loadedProfile({ status: "ACTIVE", submittedAt: new Date("2026-09-07") }),
      );
    categories.listPublic.mockResolvedValue([
      {
        id: CATEGORY_A,
        parentId: null,
        slug: "parent",
        name: "Parent",
        appliesTo: "PROFESSIONAL",
        isActive: true,
        sortOrder: 1,
        children: [],
      },
    ]);

    const service = await createService();
    const result = await service.submit(MEMBER_ID, "req-submit");

    expect(result.status).toBe("ACTIVE");
    expect(result.steps.submitted).toBe(true);
    expect(result.professional?.categories).toHaveLength(2);
    expect(prisma.professionalProfile.update).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: expect.objectContaining({ status: "ACTIVE" }),
    });
  });

  it("stores multiple professional categories", async () => {
    prisma.professionalProfile.findUnique
      .mockResolvedValueOnce({ id: PROFILE_ID, memberId: MEMBER_ID, status: "DRAFT" })
      .mockResolvedValueOnce(loadedProfile());

    const service = await createService();
    const result = await service.saveCategories(MEMBER_ID, [CATEGORY_A, CATEGORY_B], "req-cats");

    expect(categories.requireAssignable).toHaveBeenCalledWith([CATEGORY_A, CATEGORY_B]);
    expect(prisma.professionalCategory.createMany).toHaveBeenCalledWith({
      data: [
        { professionalProfileId: PROFILE_ID, categoryId: CATEGORY_A },
        { professionalProfileId: PROFILE_ID, categoryId: CATEGORY_B },
      ],
    });
    expect(result.professional?.categories.map((item) => item.id)).toEqual([
      CATEGORY_A,
      CATEGORY_B,
    ]);
  });

  it("hides exact service-area coordinates on the public professional payload", async () => {
    prisma.professionalProfile.findUnique.mockResolvedValue(
      loadedProfile({ status: "ACTIVE", submittedAt: new Date("2026-09-07") }),
    );

    const service = await createService();
    const published = await service.getPublic(PROFILE_ID);

    expect(published.serviceArea?.city).toBe("Bengaluru");
    expect(published.serviceArea?.radiusMeters).toBe(5000);
    expect(published.serviceArea).not.toHaveProperty("latitude");
    expect(published.serviceArea).not.toHaveProperty("longitude");
    expect(containsExactCoordinateKeys(published)).toBe(false);
  });
});
