import {
  CAPTCHA_PROVIDERS,
  EMAIL_PROVIDERS,
  GEOCODER_PROVIDERS,
  MEDIA_STORAGE_PROVIDERS,
  OTP_PROVIDERS,
} from "@hasut/types";
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
    EMAIL_PROVIDER: z.enum(EMAIL_PROVIDERS).default("console"),
    EMAIL_FROM: z.string().optional().default("HASUT <no-reply@hasut.local>"),
    SMTP_URL: z.string().optional().default(""),
    CAPTCHA_PROVIDER: z.enum(CAPTCHA_PROVIDERS).default("none"),
    RECAPTCHA_SITE_KEY: z.string().optional().default(""),
    RECAPTCHA_SECRET_KEY: z.string().optional().default(""),
    RECAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5),
    GOOGLE_CLIENT_ID: z.string().optional().default(""),
    FACEBOOK_APP_ID: z.string().optional().default(""),
    FACEBOOK_APP_SECRET: z.string().optional().default(""),
    GEOCODER_PROVIDER: z.enum(GEOCODER_PROVIDERS).default("console"),
    MEDIA_STORAGE: z.enum(MEDIA_STORAGE_PROVIDERS).default("local"),
    /** Empty uses a folder under the API process. Admin can point this elsewhere. */
    MEDIA_LOCAL_ROOT: z.string().optional().default(""),
    /** Public origin for file URLs. Empty uses http://127.0.0.1:$PORT. */
    API_PUBLIC_URL: z.string().optional().default(""),
    /** Encrypts storage keys at rest. Empty derives a key from the access-token secret. */
    STORAGE_CREDENTIALS_KEY: z.string().optional().default(""),
    MAPTILER_API_KEY: z.string().optional().default(""),
    STADIA_API_KEY: z.string().optional().default(""),
    LIVE_HLS_BASE_URL: z.string().optional().default(""),
    LIVE_WHIP_BASE_URL: z.string().optional().default(""),
    /** Empty leaves video stories PENDING. A path runs the story HLS worker. */
    FFMPEG_PATH: z.string().optional().default(""),
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
    if (value.NODE_ENV === "production" && value.CAPTCHA_PROVIDER === "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CAPTCHA_PROVIDER"],
        message: "CAPTCHA_PROVIDER=none is forbidden in production",
      });
    }
    if (value.CAPTCHA_PROVIDER === "recaptcha" && value.RECAPTCHA_SECRET_KEY.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RECAPTCHA_SECRET_KEY"],
        message: "RECAPTCHA_SECRET_KEY is required when CAPTCHA_PROVIDER=recaptcha",
      });
    }
    if (value.NODE_ENV === "production" && value.EMAIL_PROVIDER === "console") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["EMAIL_PROVIDER"],
        message: "EMAIL_PROVIDER=console is forbidden in production",
      });
    }
    if (value.EMAIL_PROVIDER === "smtp" && value.SMTP_URL.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_URL"],
        message: "SMTP_URL is required when EMAIL_PROVIDER=smtp",
      });
    }
    if (value.FACEBOOK_APP_ID.length > 0 && value.FACEBOOK_APP_SECRET.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FACEBOOK_APP_SECRET"],
        message: "FACEBOOK_APP_SECRET is required when FACEBOOK_APP_ID is set",
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

function isPrivateLanHost(hostname: string): boolean {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/** Public ngrok host suffixes. `apps/web/next.config.ts` allows the matching `*` origins. */
export const DEV_TUNNEL_HOST_SUFFIXES = [
  ".ngrok-free.app",
  ".ngrok-free.dev",
  ".ngrok.app",
  ".ngrok.io",
  ".ngrok.dev",
] as const;

export function isDevTunnelHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return DEV_TUNNEL_HOST_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && host.length > suffix.length,
  );
}

function pageUrl(pageOrigin: string | undefined): URL | undefined {
  if (pageOrigin === undefined || pageOrigin.length === 0) {
    return undefined;
  }
  return new URL(pageOrigin);
}

/** Absolute API origin for REST. Loopback pages use 127.0.0.1; LAN pages keep the page host. */
export function resolveBrowserApiBaseUrl(
  configured: string | undefined,
  options: { isBrowser: boolean; pageOrigin?: string },
): string {
  const api = new URL(configuredApiOrigin(configured));
  const page = pageUrl(options.pageOrigin);
  if (page !== undefined) {
    if (isDevTunnelHost(page.hostname)) {
      return page.origin;
    }
    api.hostname = isLoopbackHost(page.hostname) ? "127.0.0.1" : page.hostname;
  } else if (api.hostname === "localhost") {
    api.hostname = "127.0.0.1";
  }
  return api.origin;
}

/**
 * Socket.io cannot use the Next rewrite, so LAN pages keep the API port.
 * A tunnel page stays on that public origin; only the HTTP `/api` rewrite is proxied.
 */
export function resolveRealtimeApiBaseUrl(
  configured: string | undefined,
  pageOrigin: string | undefined,
): string {
  const api = new URL(configuredApiOrigin(configured));
  const page = pageUrl(pageOrigin);
  if (page !== undefined) {
    if (isDevTunnelHost(page.hostname)) {
      return page.origin;
    }
    api.hostname = page.hostname;
  } else if (isLoopbackHost(api.hostname) && api.hostname === "localhost") {
    api.hostname = "127.0.0.1";
  }
  return api.origin;
}

const LOCAL_API_PORT = "3001";

/**
 * Point loopback and private-LAN API asset URLs at the tunnel origin so images
 * load through the Next `/api` rewrite instead of the phone's own localhost.
 */
export function rewriteDevAssetUrl(url: string, pageOrigin: string): string {
  let page: URL;
  let asset: URL;
  try {
    page = new URL(pageOrigin);
    asset = new URL(url);
  } catch {
    return url;
  }
  if (!isDevTunnelHost(page.hostname)) {
    return url;
  }
  if (!isLoopbackHost(asset.hostname) && !isPrivateLanHost(asset.hostname)) {
    return url;
  }
  const port = asset.port.length > 0 ? asset.port : asset.protocol === "https:" ? "443" : "80";
  if (port !== LOCAL_API_PORT && !asset.pathname.startsWith("/api/")) {
    return url;
  }
  asset.protocol = page.protocol;
  asset.hostname = page.hostname;
  asset.port = page.port;
  return asset.toString();
}
