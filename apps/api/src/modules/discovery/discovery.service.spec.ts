import {
  DISCOVERY_POLICY_DEFAULTS,
  DISCOVERY_RANKING_DEFAULTS,
  LOCATION_POLICY_DEFAULTS,
} from "@hasut/config";
import { Test } from "@nestjs/testing";
import { containsExactCoordinateKeys } from "@hasut/utils";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConfigurationService } from "../configuration/configuration.service";
import { LocationsRepository } from "../locations/locations.repository";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { DiscoveryRepository } from "./discovery.repository";
import { DiscoveryService } from "./discovery.service";
import { StoriesService } from "../stories/stories.service";

const PRO_ID = "33333333-3333-4333-8333-333333333333";

describe("DiscoveryService", () => {
  const repository = {
    findNearbyMembers: jest.fn(),
    findNearbyProfessionals: jest.fn(),
    findNearbyBusinesses: jest.fn(),
  };
  const configuration = {
    getDiscoveryPolicy: jest.fn(),
    getDiscoveryRankingWeights: jest.fn(),
    getLocationPolicy: jest.fn(),
    mapRouteKeys: jest.fn(),
  };
  const locations = { readExactPoint: jest.fn() };
  const media = { photoUrl: jest.fn() };
  const stories = { pinMediaForMembers: jest.fn() };
  const prisma = {
    memberPublicLocation: { findUnique: jest.fn() },
    category: { findMany: jest.fn() },
    professionalProfile: { findMany: jest.fn(), findUnique: jest.fn() },
  };

  async function createService(): Promise<DiscoveryService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: DiscoveryRepository, useValue: repository },
        { provide: ConfigurationService, useValue: configuration },
        { provide: LocationsRepository, useValue: locations },
        { provide: MediaService, useValue: media },
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: stories },
      ],
    }).compile();
    return moduleRef.get(DiscoveryService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getDiscoveryPolicy.mockResolvedValue(DISCOVERY_POLICY_DEFAULTS);
    configuration.getDiscoveryRankingWeights.mockResolvedValue(DISCOVERY_RANKING_DEFAULTS);
    configuration.getLocationPolicy.mockResolvedValue(LOCATION_POLICY_DEFAULTS);
    repository.findNearbyMembers.mockResolvedValue([]);
    repository.findNearbyProfessionals.mockResolvedValue([]);
    repository.findNearbyBusinesses.mockResolvedValue([]);
    media.photoUrl.mockResolvedValue(null);
    stories.pinMediaForMembers.mockResolvedValue(new Map());
    prisma.professionalProfile.findMany.mockResolvedValue([]);
    prisma.professionalProfile.findUnique.mockResolvedValue(null);
    locations.readExactPoint.mockResolvedValue(null);
    configuration.mapRouteKeys.mockReturnValue({ maptilerApiKey: "", stadiaApiKey: "" });
  });

  it("ranks PostGIS repository rows and never exposes exact coordinate keys", async () => {
    repository.findNearbyProfessionals.mockResolvedValue([
      {
        id: PRO_ID,
        kind: "PROFESSIONAL",
        title: "AC Service",
        subtitle: "Esther",
        photoMediaId: null,
        categoryLabel: "Home services",
        categoryIds: [],
        availability: "AVAILABLE",
        modeCode: null,
        verified: true,
        rating: 4.3,
        reviewCount: 12,
        distanceMeters: 200,
        pinLat: 12.9716,
        pinLng: 77.5946,
        updatedAt: new Date(),
        locationLabel: "Bengaluru, Karnataka, India",
        city: "Bengaluru",
        region: "Karnataka",
        country: "India",
        countryCode: "IN",
      },
    ]);

    const service = await createService();
    const result = await service.nearby(null, { latitude: 12.97, longitude: 77.59 });

    expect(repository.findNearbyProfessionals).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 12.97,
        longitude: 77.59,
        radiusMeters: DISCOVERY_POLICY_DEFAULTS.defaultRadiusMeters,
      }),
    );
    expect(result.items[0]?.distanceBucket).toBe("200m");
    expect(result.items[0]?.href).toBe(`/professionals/${PRO_ID}`);
    expect(result.markers[0]?.pinMediaKind).toBe("PROFILE");
    expect(result.markers[0]?.initials).toBe("AS");
    expect(containsExactCoordinateKeys(result)).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/"latitude"|"longitude"|"exact"/);
  });

  it("lists nearby active stories for the map row", async () => {
    const memberId = "11111111-1111-4111-8111-111111111111";
    repository.findNearbyMembers.mockResolvedValue([
      {
        id: memberId,
        kind: "MEMBER",
        title: "Ada Lovelace",
        subtitle: "Nearby",
        photoMediaId: null,
        categoryLabel: null,
        categoryIds: [],
        availability: "AVAILABLE",
        modeCode: null,
        verified: false,
        rating: null,
        reviewCount: 0,
        distanceMeters: 400,
        pinLat: 12.97,
        pinLng: 77.59,
        updatedAt: new Date(),
        locationLabel: "Bengaluru",
        city: "Bengaluru",
        region: "Karnataka",
        country: "India",
        countryCode: "IN",
      },
    ]);
    stories.pinMediaForMembers.mockResolvedValue(
      new Map([
        [
          memberId,
          {
            kind: "IMAGE",
            imageUrl: "https://cdn.example/a.jpg",
            previewHlsUrl: null,
            storyIds: ["22222222-2222-4222-8222-222222222222"],
          },
        ],
      ]),
    );
    const service = await createService();
    const result = await service.nearby(null, { latitude: 12.97, longitude: 77.59 });
    expect(result.storyFaces).toEqual([
      {
        memberId,
        label: "Ada Lovelace",
        imageUrl: "https://cdn.example/a.jpg",
        kind: "IMAGE",
        storyIds: ["22222222-2222-4222-8222-222222222222"],
      },
    ]);
  });

  it("routes to the public pin without naming exact coordinates", async () => {
    repository.findNearbyProfessionals.mockResolvedValue([
      {
        id: PRO_ID,
        kind: "PROFESSIONAL",
        title: "AC Service",
        subtitle: "Esther",
        photoMediaId: null,
        categoryLabel: "Home services",
        categoryIds: [],
        availability: "AVAILABLE",
        modeCode: null,
        verified: true,
        rating: 4.3,
        reviewCount: 12,
        distanceMeters: 200,
        pinLat: 12.9716,
        pinLng: 77.5946,
        updatedAt: new Date(),
        locationLabel: "Bengaluru, Karnataka, India",
        city: "Bengaluru",
        region: "Karnataka",
        country: "India",
        countryCode: "IN",
      },
    ]);
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 1500.2,
            duration: 200.4,
            geometry: {
              coordinates: [
                [77.59, 12.97],
                [77.6, 12.98],
              ],
            },
          },
        ],
      }),
    } as Response);
    try {
      const service = await createService();
      const route = await service.routeTo(null, {
        latitude: 12.97,
        longitude: 77.59,
        targetKind: "PROFESSIONAL",
        targetId: PRO_ID,
      });
      expect(route.distanceMeters).toBe(1500);
      expect(route.durationSeconds).toBe(200);
      expect(route.coordinates).toHaveLength(2);
      expect(containsExactCoordinateKeys(route)).toBe(false);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("uses a stored point when the client omits coordinates", async () => {
    locations.readExactPoint.mockResolvedValue({ latitude: 12.9, longitude: 77.6 });
    prisma.memberPublicLocation.findUnique.mockResolvedValue({ label: "Home area" });
    const service = await createService();
    await service.nearby("11111111-1111-4111-8111-111111111111", {});
    expect(repository.findNearbyProfessionals).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 12.9, longitude: 77.6 }),
    );
  });

  it("fails with LOCATION_UNAVAILABLE when no origin can be resolved", async () => {
    const service = await createService();
    await expect(service.nearby(null, {})).rejects.toMatchObject({
      errorCode: "LOCATION_UNAVAILABLE",
    });
    expect(repository.findNearbyProfessionals).not.toHaveBeenCalled();
  });

  it("requires search text on the search path", async () => {
    const service = await createService();
    await expect(
      service.search(null, { latitude: 12.97, longitude: 77.59 }),
    ).rejects.toBeInstanceOf(HasutHttpException);
  });

  it("previews a nearby result with its public location label", async () => {
    repository.findNearbyProfessionals.mockResolvedValue([
      {
        id: PRO_ID,
        kind: "PROFESSIONAL",
        title: "AC Service",
        subtitle: "Esther",
        photoMediaId: null,
        categoryLabel: "Home services",
        categoryIds: [],
        availability: "AVAILABLE",
        modeCode: null,
        verified: true,
        rating: 4.3,
        reviewCount: 12,
        distanceMeters: 200,
        pinLat: 12.9716,
        pinLng: 77.5946,
        updatedAt: new Date(),
        locationLabel: "Bengaluru, Karnataka, India",
        city: "Bengaluru",
        region: "Karnataka",
        country: "India",
        countryCode: "IN",
      },
    ]);
    const service = await createService();
    const preview = await service.preview(null, "PROFESSIONAL", PRO_ID, {
      latitude: 12.97,
      longitude: 77.59,
    });
    expect(preview.approximateLocation?.label).toBe("Bengaluru, Karnataka, India");
    expect(containsExactCoordinateKeys(preview)).toBe(false);
  });
});
