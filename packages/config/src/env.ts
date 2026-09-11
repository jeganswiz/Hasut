import { GEOCODER_PROVIDERS, MEDIA_STORAGE_PROVIDERS, OTP_PROVIDERS } from "@hasut/types";
import { z } from "zod";

export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
    APP_NAME: z.string().min(1).default("hasut-api"),
    APP_VERSION: z.string().min(1).default("0.0.0"),
    PORT: z.coerce.number().int().positive().default(3001),
    API_PREFIX: z.string().min(1).default("api/v1"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3000,http://localhost:3002"),
    SENTRY_DSN: z.string().optional().default(""),
    S3_ENDPOINT: z.string().optional().default(""),
    S3_REGION: z.string().optional().default("us-east-1"),
    S3_BUCKET: z.string().optional().default("hasut-media"),
    S3_ACCESS_KEY: z.string().optional().default(""),
    S3_SECRET_KEY: z.string().optional().default(""),
    S3_FORCE_PATH_STYLE: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .default("true"),
    OTP_PROVIDER: z.enum(OTP_PROVIDERS).default("console"),
    DEV_OTP_CODE: z
      .string()
      .regex(/^$|^\d{4,8}$/, "DEV_OTP_CODE must be empty or 4–8 digits")
      .optional()
      .default(""),
    ADMIN_BOOTSTRAP_PHONE: z.string().optional().default(""),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    MSG91_AUTH_KEY: z.string().optional().default(""),
    MSG91_TEMPLATE_ID: z.string().optional().default(""),
    MSG91_SENDER: z.string().optional().default(""),
    TWILIO_ACCOUNT_SID: z.string().optional().default(""),
    TWILIO_AUTH_TOKEN: z.string().optional().default(""),
    TWILIO_VERIFY_SERVICE_SID: z.string().optional().default(""),
    GEOCODER_PROVIDER: z.enum(GEOCODER_PROVIDERS).default("console"),
    MEDIA_STORAGE: z.enum(MEDIA_STORAGE_PROVIDERS).default("memory"),
    MAPTILER_API_KEY: z.string().optional().default(""),
    STADIA_API_KEY: z.string().optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.OTP_PROVIDER === "console") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OTP_PROVIDER"],
        message: "OTP_PROVIDER=console is forbidden in production",
      });
    }
    if (value.NODE_ENV === "production" && value.MEDIA_STORAGE === "memory") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MEDIA_STORAGE"],
        message: "MEDIA_STORAGE=memory is forbidden in production",
      });
    }
    if (value.NODE_ENV === "production" && value.DEV_OTP_CODE.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEV_OTP_CODE"],
        message: "DEV_OTP_CODE is forbidden in production",
      });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(source: Record<string, unknown>): ApiEnv {
  return apiEnvSchema.parse(source);
}

export const publicClientEnvSchema = z.object({
  apiBaseUrl: z.string().url(),
});

export type PublicClientEnv = z.infer<typeof publicClientEnvSchema>;

export function parsePublicClientEnv(apiBaseUrl: string): PublicClientEnv {
  return publicClientEnvSchema.parse({ apiBaseUrl });
}

const DEFAULT_PUBLIC_API_ORIGIN = "http://127.0.0.1:3001";

function configuredApiOrigin(configured: string | undefined): string {
  const raw = (configured ?? DEFAULT_PUBLIC_API_ORIGIN).trim().replace(/\/$/, "");
  return raw.length > 0 ? raw : DEFAULT_PUBLIC_API_ORIGIN;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** Absolute API origin for REST. Loopback pages use 127.0.0.1; LAN pages keep the page host. */
export function resolveBrowserApiBaseUrl(
  configured: string | undefined,
  options: { isBrowser: boolean; pageOrigin?: string },
): string {
  const api = new URL(configuredApiOrigin(configured));
  if (options.pageOrigin !== undefined && options.pageOrigin.length > 0) {
    const page = new URL(options.pageOrigin);
    api.hostname = isLoopbackHost(page.hostname) ? "127.0.0.1" : page.hostname;
  } else if (api.hostname === "localhost") {
    api.hostname = "127.0.0.1";
  }
  return api.origin;
}

/** Socket.io cannot use the Next rewrite; point at the API host matching the page. */
export function resolveRealtimeApiBaseUrl(
  configured: string | undefined,
  pageOrigin: string | undefined,
): string {
  const api = new URL(configuredApiOrigin(configured));
  if (pageOrigin !== undefined && pageOrigin.length > 0) {
    api.hostname = new URL(pageOrigin).hostname;
  } else if (isLoopbackHost(api.hostname) && api.hostname === "localhost") {
    api.hostname = "127.0.0.1";
  }
  return api.origin;
}
