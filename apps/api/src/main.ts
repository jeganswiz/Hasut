import "reflect-metadata";
import { existsSync } from "node:fs";
import { parseApiEnv } from "@hasut/config";
import { REQUEST_ID_HEADER, fail, ok, type HealthData } from "@hasut/types";
import { splitCsv, normalizeRequestId } from "@hasut/utils";
import { Logger as NestLogger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Request, Response } from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { requestIdMiddleware } from "./common/middleware/request-id.middleware";
import type { ApiEnv } from "./config/env";
import { HealthService } from "./modules/health/health.service";
import { createHlsProxyMiddleware } from "./modules/stories/hls-proxy";
import { flushSentry, initSentry } from "./observability/sentry";

function loadLocalEnv(): void {
  for (const file of [".env", "../../.env"]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
    }
  }
}

function isAllowedBrowserOrigin(origin: string, configured: string[]): boolean {
  if (configured.includes(origin)) {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }
    return (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}

function asEnvRecord(source: NodeJS.ProcessEnv): Record<string, unknown> {
  return { ...source };
}

function writeReadyResponse(res: Response, requestId: string, data: HealthData): void {
  res.setHeader(REQUEST_ID_HEADER, requestId);
  if (data.status === "ok") {
    res.status(200).json(ok(data, requestId));
    return;
  }
  res
    .status(503)
    .json(
      fail("SERVICE_UNAVAILABLE", "One or more dependencies are down", requestId, { health: data }),
    );
}

async function bootstrap(): Promise<void> {
  loadLocalEnv();
  const env = parseApiEnv(asEnvRecord(process.env));
  initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: `${env.APP_NAME}@${env.APP_VERSION}`,
  });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useLogger(app.get(Logger));
  app.use(requestIdMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production",
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  const config = app.get(ConfigService<ApiEnv, true>);
  const corsOrigins = splitCsv(config.get("CORS_ORIGINS", { infer: true }));
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (origin === undefined || isAllowedBrowserOrigin(origin, corsOrigins)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const apiPrefix = config.get("API_PREFIX", { infer: true });
  app.setGlobalPrefix(apiPrefix);

  const swagger = new DocumentBuilder()
    .setTitle("HASUT API")
    .setDescription("HASUT Local Discovery Network — Phase 1 API")
    .setVersion(config.get("APP_VERSION", { infer: true }))
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));

  const health = app.get(HealthService);
  const http = app.getHttpAdapter().getInstance() as {
    get: (path: string, handler: (req: Request, res: Response) => void) => void;
    use: (path: string, handler: (req: Request, res: Response) => void) => void;
  };

  http.get("/health", (req, res) => {
    const requestId = normalizeRequestId(req.header(REQUEST_ID_HEADER));
    void health.ready().then((data) => writeReadyResponse(res, requestId, data));
  });
  http.get("/health/live", (req, res) => {
    const requestId = normalizeRequestId(req.header(REQUEST_ID_HEADER));
    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.status(200).json(ok(health.live(), requestId));
  });
  http.get("/health/ready", (req, res) => {
    const requestId = normalizeRequestId(req.header(REQUEST_ID_HEADER));
    void health.ready().then((data) => writeReadyResponse(res, requestId, data));
  });

  http.use(
    "/media/hls",
    createHlsProxyMiddleware(config.get("LIVE_HLS_BASE_URL", { infer: true })),
  );

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  const logger = new NestLogger("Bootstrap");
  logger.log(`HASUT API listening on ${port} (${apiPrefix})`);
}

bootstrap().catch(async (error: unknown) => {
  const logger = new NestLogger("Bootstrap");
  logger.error(error instanceof Error ? error.message : "Fatal bootstrap error");
  await flushSentry();
  process.exit(1);
});
