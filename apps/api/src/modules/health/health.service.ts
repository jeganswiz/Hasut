import type { HealthData, HealthProbes, ProbeStatus } from "@hasut/types";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { ApiEnv } from "../../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

interface PostgisVersionRow {
  postgis_version: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  live(): HealthData {
    return {
      status: "ok",
      scope: "live",
      service: this.config.get("APP_NAME", { infer: true }),
      version: this.config.get("APP_VERSION", { infer: true }),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async ready(): Promise<HealthData> {
    const [postgres, postgis, redis] = await Promise.all([
      this.probePostgres(),
      this.probePostgis(),
      this.probeRedis(),
    ]);

    const checks: HealthProbes = {
      postgres: postgres.status,
      postgis: postgis.status,
      redis: redis.status,
    };
    const degraded =
      postgres.status === "down" || postgis.status === "down" || redis.status === "down";

    return {
      status: degraded ? "degraded" : "ok",
      scope: "ready",
      service: this.config.get("APP_NAME", { infer: true }),
      version: this.config.get("APP_VERSION", { infer: true }),
      uptimeSeconds: Math.floor(process.uptime()),
      checks,
      postgisVersion: postgis.version,
    };
  }

  private async probePostgres(): Promise<{ status: ProbeStatus }> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return { status: "up" };
    } catch (error) {
      this.logger.error({ err: error }, "PostgreSQL probe failed");
      return { status: "down" };
    }
  }

  private async probePostgis(): Promise<{ status: ProbeStatus; version?: string }> {
    try {
      const rows = await this.prisma.$queryRaw<PostgisVersionRow[]>(
        Prisma.sql`SELECT PostGIS_Version() as postgis_version`,
      );
      const version = rows[0]?.postgis_version;
      if (version === undefined || version.length === 0) {
        return { status: "down" };
      }
      return { status: "up", version };
    } catch (error) {
      this.logger.error({ err: error }, "PostGIS probe failed");
      return { status: "down" };
    }
  }

  private async probeRedis(): Promise<{ status: ProbeStatus }> {
    try {
      const pong = await this.redis.ping();
      return { status: pong.toUpperCase() === "PONG" ? "up" : "down" };
    } catch (error) {
      this.logger.error({ err: error }, "Redis probe failed");
      return { status: "down" };
    }
  }
}
