import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "./audit.service";

describe("AuditService", () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  async function service(): Promise<AuditService> {
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return moduleRef.get(AuditService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        actorId: "admin-1",
        action: "THEME_PUBLISH",
        entity: "theme_config",
        entityId: "t1",
        requestId: "req-1",
        createdAt: new Date("2026-09-20T00:00:00.000Z"),
      },
    ]);
  });

  it("lists audit rows for admins without phone fields", async () => {
    const audit = await service();
    const rows = await audit.list(["ADMIN"], {});
    expect(rows[0]?.action).toBe("THEME_PUBLISH");
    expect(JSON.stringify(rows)).not.toMatch(/phone/i);
  });

  it("rejects a support agent from the audit viewer", async () => {
    const audit = await service();
    await expect(audit.list(["SUPPORT_AGENT"], {})).rejects.toBeInstanceOf(HasutHttpException);
  });
});
