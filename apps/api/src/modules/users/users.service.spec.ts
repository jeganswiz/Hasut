import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

const MEMBER = {
  id: "member-1",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  roles: [{ role: "MEMBER" }],
  profile: { displayName: "Ada" },
};

describe("UsersService admin", () => {
  const prisma = {
    member: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    session: { updateMany: jest.fn() },
    memberRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  async function service(): Promise<UsersService> {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return moduleRef.get(UsersService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.member.findMany.mockResolvedValue([MEMBER]);
    prisma.member.findUnique.mockResolvedValue({ ...MEMBER, sessions: [] });
    prisma.member.update.mockResolvedValue(MEMBER);
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    prisma.auditLog.create.mockResolvedValue({});
    prisma.memberRole.deleteMany.mockResolvedValue({ count: 1 });
    prisma.memberRole.createMany.mockResolvedValue({ count: 2 });
  });

  it("searches members without phone fields", async () => {
    const users = await service();
    const rows = await users.searchMembers(["ADMIN"], "Ada");
    expect(rows[0]?.displayName).toBe("Ada");
    expect(JSON.stringify(rows)).not.toMatch(/phone/i);
  });

  it("rejects a member from searching the admin directory", async () => {
    const users = await service();
    await expect(users.searchMembers(["MEMBER"], "Ada")).rejects.toBeInstanceOf(HasutHttpException);
  });

  it("prevents changing own roles", async () => {
    const users = await service();
    await expect(
      users.setRoles("member-1", ["ADMIN"], "member-1", ["ADMIN"], "req-1"),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
  });
});
