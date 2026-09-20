import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { PatronsService } from "./patrons.service";

describe("PatronsService", () => {
  const prisma = {
    connection: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };

  async function service(): Promise<PatronsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [PatronsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return moduleRef.get(PatronsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.connection.findMany.mockResolvedValue([]);
  });

  it("treats a member as their own Patron without hitting the database", async () => {
    const patrons = await service();
    await expect(patrons.isPatronOf("m1", "m1")).resolves.toBe(true);
    expect(prisma.connection.findFirst).not.toHaveBeenCalled();
  });

  it("only counts an ACCEPTED connection", async () => {
    prisma.connection.findFirst.mockResolvedValue(null);
    const patrons = await service();

    await expect(patrons.isPatronOf("owner", "stranger")).resolves.toBe(false);
    expect(prisma.connection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACCEPTED" }) }),
    );
  });

  it("is symmetric, so either side of the pair qualifies", async () => {
    prisma.connection.findFirst.mockResolvedValue({ id: "c1" });
    const patrons = await service();
    await expect(patrons.isPatronOf("owner", "peer")).resolves.toBe(true);

    const where = prisma.connection.findFirst.mock.calls[0][0].where as {
      OR: Array<{ requesterId: string; addresseeId: string }>;
    };
    expect(where.OR).toEqual([
      { requesterId: "owner", addresseeId: "peer" },
      { requesterId: "peer", addresseeId: "owner" },
    ]);
  });

  it("resolves a screen of pins in a single query", async () => {
    prisma.connection.findMany.mockResolvedValue([
      { requesterId: "viewer", addresseeId: "a" },
      { requesterId: "c", addresseeId: "viewer" },
    ]);
    const patrons = await service();

    const result = await patrons.patronOwnersAmong(["a", "b", "c"], "viewer");

    expect(prisma.connection.findMany).toHaveBeenCalledTimes(1);
    expect([...result].sort()).toEqual(["a", "c"]);
  });

  it("includes the viewer when they appear in their own pin list", async () => {
    const patrons = await service();
    const result = await patrons.patronOwnersAmong(["viewer"], "viewer");

    expect(result.has("viewer")).toBe(true);
    expect(prisma.connection.findMany).not.toHaveBeenCalled();
  });

  it("counts accepted connections on either side of the pair", async () => {
    prisma.connection.count.mockResolvedValue(4);
    const patrons = await service();

    await expect(patrons.countFor("m1")).resolves.toBe(4);
    expect(prisma.connection.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACCEPTED" }) }),
    );
  });
});
