import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

describe("HealthService", () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const redis = {
    ping: jest.fn(),
  };
  const config = {
    get: (key: string) => {
      if (key === "APP_NAME") {
        return "hasut-api";
      }
      if (key === "APP_VERSION") {
        return "0.0.0";
      }
      return undefined;
    },
  };

  async function createService(): Promise<HealthService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return moduleRef.get(HealthService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns a live payload without probing dependencies", async () => {
    const service = await createService();
    const live = service.live();
    expect(live.scope).toBe("live");
    expect(live.status).toBe("ok");
    expect(live.checks).toBeUndefined();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns ready ok when postgres, postgis, and redis respond", async () => {
    let rawCalls = 0;
    prisma.$queryRaw.mockImplementation(async () => {
      rawCalls += 1;
      if (rawCalls === 2) {
        return [{ postgis_version: "3.5.0" }];
      }
      return [{ ok: 1 }];
    });
    redis.ping.mockResolvedValue("PONG");

    const service = await createService();
    const ready = await service.ready();
    expect(ready.status).toBe("ok");
    expect(ready.checks?.postgres).toBe("up");
    expect(ready.checks?.postgis).toBe("up");
    expect(ready.checks?.redis).toBe("up");
    expect(ready.postgisVersion).toBe("3.5.0");
  });

  it("returns degraded when redis is down", async () => {
    prisma.$queryRaw.mockResolvedValue([{ postgis_version: "3.5.0" }]);
    redis.ping.mockRejectedValue(new Error("ECONNREFUSED"));

    const service = await createService();
    const ready = await service.ready();
    expect(ready.status).toBe("degraded");
    expect(ready.checks?.redis).toBe("down");
  });
});
