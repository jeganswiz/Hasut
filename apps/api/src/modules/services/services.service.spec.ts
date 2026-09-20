import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ServicesService } from "./services.service";

describe("ServicesService", () => {
  const prisma = {
    professionalProfile: { findUnique: jest.fn() },
    category: { findUnique: jest.fn() },
    serviceOffering: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };

  async function service(): Promise<ServicesService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(ServicesService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.professionalProfile.findUnique.mockResolvedValue({ id: "pro-1", memberId: "m1" });
    prisma.category.findUnique.mockResolvedValue({ id: "cat-1", isActive: true });
    prisma.serviceOffering.create.mockResolvedValue({
      id: "off-1",
      professionalProfileId: "pro-1",
      categoryId: "cat-1",
      title: "AC repair",
      description: "Window units",
      displayPriceAmount: null,
      displayCurrency: null,
      isActive: true,
    });
  });

  it("creates an offering without booking fields", async () => {
    const services = await service();
    const created = await services.create(
      "m1",
      { categoryId: "cat-1", title: "AC repair", description: "" },
      "req",
    );
    expect(created.title).toBe("AC repair");
    expect(created).not.toHaveProperty("booking");
  });

  it("rejects a member without a professional profile", async () => {
    prisma.professionalProfile.findUnique.mockResolvedValue(null);
    const services = await service();
    await expect(
      services.create("m1", { categoryId: "cat-1", title: "AC repair", description: "" }, "req"),
    ).rejects.toBeInstanceOf(HasutHttpException);
  });
});
