import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { VerificationService } from "./verification.service";

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const MEDIA_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const PROFILE_ID = "33333333-3333-4333-8333-333333333333";

describe("VerificationService", () => {
  const prisma = {
    verificationRequest: { findFirst: jest.fn(), create: jest.fn() },
    professionalProfile: { findUnique: jest.fn(), update: jest.fn() },
  };
  const media = { requireReadyVerification: jest.fn() };
  const audit = { record: jest.fn() };

  async function createService(): Promise<VerificationService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(VerificationService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    media.requireReadyVerification.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    prisma.verificationRequest.findFirst.mockResolvedValue(null);
    prisma.verificationRequest.create.mockResolvedValue({
      id: REQUEST_ID,
      type: "IDENTITY",
      status: "PENDING",
      payloadJson: { documentMediaIds: [MEDIA_ID] },
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      decidedAt: null,
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
    expect(prisma.professionalProfile.update).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: { identityVerificationStatus: "PENDING" },
    });
    const updateData = prisma.professionalProfile.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateData.data).not.toHaveProperty("skillVerificationStatus");
  });
});
