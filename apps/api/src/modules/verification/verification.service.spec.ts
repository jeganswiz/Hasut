import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { MediaService } from "../media/media.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { VerificationService } from "./verification.service";

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const MEDIA_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const PROFILE_ID = "33333333-3333-4333-8333-333333333333";

describe("VerificationService", () => {
  const prisma = {
    verificationRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    professionalProfile: { findUnique: jest.fn(), update: jest.fn() },
  };
  const media = { requireReadyVerification: jest.fn() };
  const audit = { record: jest.fn() };
  const profiles = { getPreview: jest.fn() };
  const notifications = { notify: jest.fn() };

  async function createService(): Promise<VerificationService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
        { provide: AuditService, useValue: audit },
        { provide: ProfilesService, useValue: profiles },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    return moduleRef.get(VerificationService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    media.requireReadyVerification.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    notifications.notify.mockResolvedValue(null);
    profiles.getPreview.mockResolvedValue({
      id: MEMBER_ID,
      displayName: "Ada",
      photoUrl: null,
    });
    prisma.verificationRequest.findFirst.mockResolvedValue(null);
    prisma.verificationRequest.create.mockResolvedValue({
      id: REQUEST_ID,
      type: "IDENTITY",
      status: "PENDING",
      payloadJson: { documentMediaIds: [MEDIA_ID] },
      reviewNote: null,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      decidedAt: null,
      memberId: MEMBER_ID,
    });
    prisma.professionalProfile.findUnique.mockResolvedValue({
      id: PROFILE_ID,
      identityVerificationStatus: "NOT_STARTED",
      skillVerificationStatus: "NOT_STARTED",
    });
    prisma.professionalProfile.update.mockResolvedValue({});
  });

  it("creates an identity verification request and leaves skill verification untouched", async () => {
    const service = await createService();
    const created = await service.requestIdentity(MEMBER_ID, [MEDIA_ID], "req-verify");

    expect(created.type).toBe("IDENTITY");
    expect(created.status).toBe("PENDING");
    expect(created.documentMediaIds).toEqual([MEDIA_ID]);
    expect(created.reviewNote).toBeNull();
    expect(prisma.professionalProfile.update).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: { identityVerificationStatus: "PENDING" },
    });
    const updateData = prisma.professionalProfile.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateData.data).not.toHaveProperty("skillVerificationStatus");
  });

  it("lets an admin approve identity without changing skill verification", async () => {
    prisma.verificationRequest.findUnique.mockResolvedValue({
      id: REQUEST_ID,
      memberId: MEMBER_ID,
      type: "IDENTITY",
      status: "PENDING",
      payloadJson: { documentMediaIds: [MEDIA_ID] },
      reviewNote: null,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      decidedAt: null,
    });
    prisma.verificationRequest.update.mockResolvedValue({
      id: REQUEST_ID,
      memberId: MEMBER_ID,
      type: "IDENTITY",
      status: "VERIFIED",
      payloadJson: { documentMediaIds: [MEDIA_ID] },
      reviewNote: null,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      decidedAt: new Date("2026-09-20T00:00:00.000Z"),
    });
    const service = await createService();
    const decided = await service.decide(
      ADMIN_ID,
      ["ADMIN"],
      REQUEST_ID,
      { decision: "APPROVE", reviewNote: "" },
      "req-decide",
    );
    expect(decided.status).toBe("VERIFIED");
    expect(prisma.professionalProfile.update).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: { identityVerificationStatus: "VERIFIED" },
    });
    const updateData = prisma.professionalProfile.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateData.data).not.toHaveProperty("skillVerificationStatus");
    expect(notifications.notify).toHaveBeenCalledWith(MEMBER_ID, "verification.approved", {
      outcome: "VERIFIED",
    });
  });

  it("rejects a member from deciding verification", async () => {
    const service = await createService();
    await expect(
      service.decide(
        MEMBER_ID,
        ["MEMBER"],
        REQUEST_ID,
        { decision: "APPROVE", reviewNote: "" },
        "req-forbidden",
      ),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
  });
});
