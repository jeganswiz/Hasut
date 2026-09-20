import { REPORTS_POLICY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { ReportsService } from "./reports.service";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";

describe("ReportsService", () => {
  const prisma = {
    block: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    connection: { updateMany: jest.fn() },
    report: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    profile: { updateMany: jest.fn() },
    message: { updateMany: jest.fn() },
    business: { updateMany: jest.fn() },
    moderationAction: { create: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const configuration = { getReportsPolicy: jest.fn() };
  const profiles = { getPreview: jest.fn() };
  const audit = { record: jest.fn() };

  async function createService(): Promise<ReportsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigurationService, useValue: configuration },
        { provide: ProfilesService, useValue: profiles },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(ReportsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getReportsPolicy.mockResolvedValue(REPORTS_POLICY_DEFAULTS);
    profiles.getPreview.mockResolvedValue({ id: PEER, displayName: "Ben", photoUrl: null });
  });

  it("cancels pending connections when a member is blocked", async () => {
    prisma.block.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    prisma.block.create.mockResolvedValue({
      id: "block-1",
      blockerId: ACTOR,
      blockedId: PEER,
      createdAt: new Date(),
    });
    const service = await createService();
    const view = await service.block(ACTOR, PEER);
    expect(prisma.connection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
    expect(JSON.stringify(view)).not.toMatch(/phone/i);
  });

  it("treats a block as bidirectional for interaction checks", async () => {
    prisma.block.findFirst.mockResolvedValue({ id: "block-1" });
    const service = await createService();
    await expect(service.assertNotBlocked(ACTOR, PEER)).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    });
  });

  it("hides a reported profile and does not include a phone number", async () => {
    const report = {
      id: "rep-1",
      reporterId: ACTOR,
      targetType: "PROFILE" as const,
      targetId: PEER,
      reasonCode: "SPAM",
      details: "",
      status: "OPEN" as const,
      createdAt: new Date(),
    };
    prisma.report.findUnique.mockResolvedValue(report);
    prisma.profile.updateMany.mockResolvedValue({ count: 1 });
    prisma.report.update.mockResolvedValue({ ...report, status: "ACTIONED" });
    prisma.moderationAction.create.mockResolvedValue({});
    const service = await createService();
    const view = await service.moderate(ACTOR, ["MODERATOR"], "rep-1", "HIDE", "req-hide");
    expect(view.status).toBe("ACTIONED");
    expect(view.hidden).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/phone/i);
    expect(prisma.profile.updateMany).toHaveBeenCalledWith({
      where: { memberId: PEER },
      data: { isDiscoverable: false },
    });
  });

  it("rejects a member from moderating reports", async () => {
    const service = await createService();
    await expect(
      service.moderate(ACTOR, ["MEMBER"], "rep-1", "HIDE", "req-no"),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
  });
});
