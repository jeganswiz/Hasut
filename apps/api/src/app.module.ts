import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import type { Request } from "express";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import { getRequestId } from "./common/middleware/request-id.middleware";
import { validateEnv, type ApiEnv } from "./config/env";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ConfigurationModule } from "./modules/configuration/configuration.module";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { RedisModule } from "./modules/redis/redis.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { DiscoveryModule } from "./modules/discovery/discovery.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { MediaModule } from "./modules/media/media.module";
import { ProfessionalsModule } from "./modules/professionals/professionals.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { UsersModule } from "./modules/users/users.module";
import { ConnectionsModule } from "./modules/connections/connections.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { VerificationModule } from "./modules/verification/verification.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      envFilePath: [".env", "../../.env"],
      validate: (config) => validateEnv(config),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<ApiEnv, true>) => {
        const environment = config.get("NODE_ENV", { infer: true });
        return {
          pinoHttp: {
            level: config.get("LOG_LEVEL", { infer: true }),
            genReqId: (req) => getRequestId(req as Request),
            customProps: (req) => ({ requestId: getRequestId(req as Request) }),
            redact: {
              paths: ["req.headers.authorization", "req.headers.cookie"],
              censor: "[Redacted]",
            },
            transport:
              environment === "development"
                ? { target: "pino-pretty", options: { singleLine: true, colorize: true } }
                : undefined,
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    ConfigurationModule,
    RealtimeModule,
    AuditModule,
    UsersModule,
    AuthModule,
    MediaModule,
    LocationsModule,
    ProfilesModule,
    CategoriesModule,
    ProfessionalsModule,
    BusinessesModule,
    DiscoveryModule,
    VerificationModule,
    ConnectionsModule,
    ReportsModule,
    NotificationsModule,
    MessagingModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
