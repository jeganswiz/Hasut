import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ConfigurationService } from "./configuration.service";

describe("ConfigurationService theme", () => {
  const prisma = {
    themeConfig: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redis = { del: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn() };

  async function service(): Promise<ConfigurationService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfigurationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: redis },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(ConfigurationService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.themeConfig.findFirst.mockResolvedValue(null);
    prisma.themeConfig.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    );
    prisma.themeConfig.updateMany.mockResolvedValue({ count: 0 });
    redis.del.mockResolvedValue(1);
    audit.record.mockResolvedValue(undefined);
  });

  it("returns contrast warnings for a low-contrast draft", async () => {
    prisma.themeConfig.findFirst.mockResolvedValue({
      version: 2,
      status: "DRAFT",
      tokensJson: { ...DEFAULT_THEME_TOKENS, primary: "#ffffff", textOnPrimary: "#ffffff" },
    });
    const configuration = await service();
    const editor = await configuration.getThemeEditor();
    expect(editor.contrastWarnings.length).toBeGreaterThan(0);
  });

  it("publishes a theme and busts cache", async () => {
    prisma.themeConfig.findFirst
      .mockResolvedValueOnce({
        id: "theme-1",
        version: 3,
        status: "DRAFT",
        tokensJson: DEFAULT_THEME_TOKENS,
      })
      .mockResolvedValue({
        version: 3,
        status: "PUBLISHED",
        tokensJson: DEFAULT_THEME_TOKENS,
      });
    prisma.themeConfig.update.mockResolvedValue({});
    const configuration = await service();
    await configuration.publishTheme("admin-1", "req-theme");
    expect(redis.del).toHaveBeenCalledWith("theme:published");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "THEME_PUBLISH" }));
  });
});
