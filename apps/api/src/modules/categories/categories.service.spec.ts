import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CategoriesService } from "./categories.service";

const PARENT_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "22222222-2222-4222-8222-222222222222";

describe("CategoriesService", () => {
  const prisma = {
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    professionalCategory: { count: jest.fn() },
  };
  const audit = { record: jest.fn() };

  async function createService(): Promise<CategoriesService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(CategoriesService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    audit.record.mockResolvedValue(undefined);
  });

  it("creates a parent and child category", async () => {
    const parent = {
      id: PARENT_ID,
      parentId: null,
      slug: "home-services",
      name: "Home services",
      appliesTo: "PROFESSIONAL",
      isActive: true,
      sortOrder: 10,
    };
    const child = {
      id: CHILD_ID,
      parentId: PARENT_ID,
      slug: "plumbing",
      name: "Plumbing",
      appliesTo: "PROFESSIONAL",
      isActive: true,
      sortOrder: 10,
    };
    prisma.category.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(child);
    prisma.category.create.mockResolvedValueOnce(parent).mockResolvedValueOnce(child);
    prisma.category.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const service = await createService();
    const createdParent = await service.create(
      "admin-1",
      { name: "Home services", appliesTo: "PROFESSIONAL", sortOrder: 10 },
      "req-1",
    );
    const createdChild = await service.create(
      "admin-1",
      { name: "Plumbing", parentId: PARENT_ID, appliesTo: "PROFESSIONAL", sortOrder: 10 },
      "req-2",
    );

    expect(createdParent.slug).toBe("home-services");
    expect(createdChild.parentId).toBe(PARENT_ID);
    expect(prisma.category.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ parentId: PARENT_ID, slug: "plumbing" }),
      }),
    );
  });

  it("rejects a parent cycle", async () => {
    const parent = {
      id: PARENT_ID,
      parentId: null,
      slug: "home-services",
      name: "Home services",
      appliesTo: "ALL",
      isActive: true,
      sortOrder: 10,
    };
    const child = {
      id: CHILD_ID,
      parentId: PARENT_ID,
      slug: "plumbing",
      name: "Plumbing",
      appliesTo: "ALL",
      isActive: true,
      sortOrder: 10,
    };
    prisma.category.findUnique
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent);

    const service = await createService();
    await expect(
      service.update("admin-1", CHILD_ID, { parentId: CHILD_ID }, "req-cycle"),
    ).rejects.toBeInstanceOf(HasutHttpException);
  });
});
