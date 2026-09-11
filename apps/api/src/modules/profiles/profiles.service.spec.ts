import { Test } from "@nestjs/testing";
import { containsExactCoordinateKeys } from "@hasut/utils";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { LocationsService } from "../locations/locations.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "./profiles.service";

const MEMBER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";
const MODE = { id: "mode-1", code: "AVAILABLE", label: "Available" };

describe("ProfilesService", () => {
  const prisma = {
    currentMode: { findMany: jest.fn(), findFirst: jest.fn() },
    profile: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const locations = {
    getApproximateLocation: jest.fn(),
    hasStoredLocation: jest.fn(),
  };
  const media = {
    requireReadyAvatar: jest.fn(),
    photoUrl: jest.fn(),
  };
  const audit = { record: jest.fn() };

  async function createService(): Promise<ProfilesService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LocationsService, useValue: locations },
        { provide: MediaService, useValue: media },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(ProfilesService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    locations.getApproximateLocation.mockResolvedValue({
      label: "Bengaluru, Karnataka, India",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
    });
    locations.hasStoredLocation.mockResolvedValue(true);
    media.photoUrl.mockResolvedValue(null);
    media.requireReadyAvatar.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    prisma.currentMode.findFirst.mockResolvedValue(MODE);
  });

  it("creates a profile", async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.profile.upsert.mockResolvedValue({
      memberId: MEMBER_ID,
      displayName: "Jegan",
      bio: "Builder",
      photoMediaId: null,
      statusText: "Open to work",
      isDiscoverable: true,
      currentMode: MODE,
    });

    const service = await createService();
    const created = await service.createOrReplace(
      MEMBER_ID,
      MEMBER_ID,
      {
        displayName: "Jegan",
        bio: "Builder",
        statusText: "Open to work",
        currentModeCode: "AVAILABLE",
      },
      "req-1",
    );

    expect(created.displayName).toBe("Jegan");
    expect(created.completion.percentage).toBeGreaterThan(0);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROFILE_CREATED" }),
    );
  });

  it("updates a profile", async () => {
    const existing = {
      memberId: MEMBER_ID,
      displayName: "Jegan",
      bio: "Builder",
      photoMediaId: null,
      statusText: "",
      isDiscoverable: true,
      currentMode: MODE,
    };
    prisma.profile.findUnique.mockResolvedValue(existing);
    prisma.profile.upsert.mockResolvedValue({ ...existing, bio: "Updated bio" });

    const service = await createService();
    const updated = await service.update(MEMBER_ID, MEMBER_ID, { bio: "Updated bio" }, "req-2");
    expect(updated.bio).toBe("Updated bio");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROFILE_UPDATED" }),
    );
  });

  it("rejects unauthorized profile modification", async () => {
    const service = await createService();
    await expect(
      service.update(OTHER_ID, MEMBER_ID, { bio: "hacked" }, "req-3"),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it("hides exact coordinates and phone on the public profile", async () => {
    prisma.profile.findUnique.mockResolvedValue({
      memberId: MEMBER_ID,
      displayName: "Jegan",
      bio: "Builder",
      photoMediaId: null,
      statusText: "Creating",
      isDiscoverable: true,
      currentMode: MODE,
    });

    const service = await createService();
    const publicView = await service.getPublicProfile(OTHER_ID, MEMBER_ID);
    expect(publicView.approximateLocation?.city).toBe("Bengaluru");
    expect(containsExactCoordinateKeys(publicView)).toBe(false);
    expect(JSON.stringify(publicView)).not.toMatch(/phone/i);
    expect(publicView).not.toHaveProperty("phoneE164");
    expect(publicView).not.toHaveProperty("exact");
  });

  it("does not expose a hidden profile to other members", async () => {
    prisma.profile.findUnique.mockResolvedValue({
      memberId: MEMBER_ID,
      displayName: "Hidden",
      bio: "",
      photoMediaId: null,
      statusText: "",
      isDiscoverable: false,
      currentMode: null,
    });

    const service = await createService();
    await expect(service.getPublicProfile(OTHER_ID, MEMBER_ID)).rejects.toBeInstanceOf(
      HasutHttpException,
    );
  });
});
