import { DISCOVERY_POLICY_DEFAULTS, LOCATION_POLICY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { containsExactCoordinateKeys } from "@hasut/utils";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEvents } from "../realtime/realtime.events";
import { REVERSE_GEOCODER } from "./geocoder/reverse-geocoder";
import { LocationsRepository } from "./locations.repository";
import { LocationsService } from "./locations.service";

const MEMBER_ID = "11111111-1111-1111-1111-111111111111";

describe("LocationsService", () => {
  const prisma = {
    memberLocation: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    memberPublicLocation: { findUnique: jest.fn(), upsert: jest.fn() },
    profile: { findUnique: jest.fn() },
  };
  const repository = {
    writeExactPoint: jest.fn(),
    writeApproximatePoint: jest.fn(),
    readExactPoint: jest.fn(),
  };
  const configuration = { getLocationPolicy: jest.fn(), getDiscoveryPolicy: jest.fn() };
  const audit = { record: jest.fn() };
  const realtime = { publishCells: jest.fn() };
  const geocoder = { reverse: jest.fn() };

  async function createService(): Promise<LocationsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LocationsRepository, useValue: repository },
        { provide: ConfigurationService, useValue: configuration },
        { provide: AuditService, useValue: audit },
        { provide: RealtimeEvents, useValue: realtime },
        { provide: REVERSE_GEOCODER, useValue: geocoder },
      ],
    }).compile();
    return moduleRef.get(LocationsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getLocationPolicy.mockResolvedValue(LOCATION_POLICY_DEFAULTS);
    configuration.getDiscoveryPolicy.mockResolvedValue(DISCOVERY_POLICY_DEFAULTS);
    audit.record.mockResolvedValue(undefined);
    prisma.profile.findUnique.mockResolvedValue({ displayName: "Asha" });
    geocoder.reverse.mockResolvedValue({
      label: "Bengaluru, Karnataka, India",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
    });
    repository.writeExactPoint.mockResolvedValue(undefined);
    repository.writeApproximatePoint.mockResolvedValue(undefined);
    repository.readExactPoint.mockResolvedValue(null);
    prisma.memberPublicLocation.upsert.mockResolvedValue({});
    prisma.memberLocation.update.mockResolvedValue({});
  });

  it("updates location after permission is granted", async () => {
    prisma.memberLocation.findUnique
      .mockResolvedValueOnce({
        memberId: MEMBER_ID,
        permission: "GRANTED",
        accuracyMeters: null,
        updatedAt: new Date(Date.now() - 180_000),
      })
      .mockResolvedValueOnce({
        memberId: MEMBER_ID,
        permission: "GRANTED",
        accuracyMeters: 12,
        updatedAt: new Date(),
      });
    repository.readExactPoint
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ latitude: 12.9716, longitude: 77.5946 });
    prisma.memberPublicLocation.findUnique.mockResolvedValue({
      label: "Bengaluru, Karnataka, India",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
    });

    const service = await createService();
    const result = await service.updateExactLocation(
      MEMBER_ID,
      { latitude: 12.9716, longitude: 77.5946, accuracyMeters: 12 },
      "req-loc",
    );

    expect(repository.writeExactPoint).toHaveBeenCalled();
    expect(repository.writeApproximatePoint).toHaveBeenCalled();
    expect(result.exact?.latitude).toBe(12.9716);
    expect(result.approximate?.city).toBe("Bengaluru");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOCATION_UPDATED",
        afterJson: expect.not.objectContaining({ latitude: expect.anything() }),
      }),
    );
    expect(realtime.publishCells).toHaveBeenCalled();
    const payload = realtime.publishCells.mock.calls[0]?.[2] as { marker: { pinLat: number } };
    expect(payload.marker.pinLat).toEqual(expect.any(Number));
    expect(payload.marker).not.toHaveProperty("latitude");
  });

  it("refuses an exact location write without permission", async () => {
    prisma.memberLocation.findUnique.mockResolvedValue({
      memberId: MEMBER_ID,
      permission: "DENIED",
      updatedAt: new Date(),
    });

    const service = await createService();
    await expect(
      service.updateExactLocation(MEMBER_ID, { latitude: 12.97, longitude: 77.59 }, "req-denied"),
    ).rejects.toMatchObject({ errorCode: "LOCATION_PERMISSION_DENIED" });
    expect(repository.writeExactPoint).not.toHaveBeenCalled();
  });

  it("keeps exact coordinates off the public approximation", async () => {
    prisma.memberPublicLocation.findUnique.mockResolvedValue({
      label: "Bengaluru, Karnataka, India",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
    });

    const service = await createService();
    const publicLocation = await service.getApproximateLocation(MEMBER_ID);
    expect(publicLocation?.label).toContain("Bengaluru");
    expect(containsExactCoordinateKeys(publicLocation)).toBe(false);
    expect(publicLocation).not.toHaveProperty("latitude");
    expect(publicLocation).not.toHaveProperty("cellId");
  });

  it("skips a write when the member has not moved far enough", async () => {
    prisma.memberLocation.findUnique.mockResolvedValue({
      memberId: MEMBER_ID,
      permission: "GRANTED",
      accuracyMeters: 12,
      updatedAt: new Date(),
    });
    repository.readExactPoint.mockResolvedValue({ latitude: 12.9716, longitude: 77.5946 });
    prisma.memberPublicLocation.findUnique.mockResolvedValue({
      label: "Bengaluru, Karnataka, India",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
    });

    const service = await createService();
    await service.updateExactLocation(
      MEMBER_ID,
      { latitude: 12.97161, longitude: 77.59461 },
      "req-still",
    );
    expect(repository.writeExactPoint).not.toHaveBeenCalled();
    expect(realtime.publishCells).not.toHaveBeenCalled();
  });

  it("rate-limits a real move inside the configured interval", async () => {
    prisma.memberLocation.findUnique.mockResolvedValue({
      memberId: MEMBER_ID,
      permission: "GRANTED",
      accuracyMeters: 12,
      updatedAt: new Date(),
    });
    repository.readExactPoint.mockResolvedValue({ latitude: 12.9716, longitude: 77.5946 });

    const service = await createService();
    await expect(
      service.updateExactLocation(MEMBER_ID, { latitude: 13.05, longitude: 80.24 }, "req-soon"),
    ).rejects.toMatchObject({ errorCode: "RATE_LIMITED" });
    expect(repository.writeExactPoint).not.toHaveBeenCalled();
  });

  it("surfaces LOCATION_PERMISSION_DENIED as a Hasut error", async () => {
    prisma.memberLocation.findUnique.mockResolvedValue(null);
    const service = await createService();
    await expect(
      service.updateExactLocation(MEMBER_ID, { latitude: 1, longitude: 2 }, "req"),
    ).rejects.toBeInstanceOf(HasutHttpException);
  });
});
