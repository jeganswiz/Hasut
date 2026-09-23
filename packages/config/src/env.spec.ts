import { parseApiEnv, resolveBrowserApiBaseUrl, resolveRealtimeApiBaseUrl } from "./env";

const secrets = {
  JWT_ACCESS_SECRET: "hasut-dev-access-secret-32chars-min",
  JWT_REFRESH_SECRET: "hasut-dev-refresh-secret-32chars-min",
};

describe("parseApiEnv", () => {
  it("parses required infrastructure URLs", () => {
    const env = parseApiEnv({
      DATABASE_URL: "postgresql://hasut:hasut@localhost:5432/hasut",
      REDIS_URL: "redis://localhost:6379",
      ...secrets,
    });
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
    expect(env.OTP_PROVIDER).toBe("console");
    expect(env.GEOCODER_PROVIDER).toBe("console");
    expect(env.MEDIA_STORAGE).toBe("memory");
    expect(env.MAPTILER_API_KEY).toBe("");
    expect(env.STADIA_API_KEY).toBe("");
    expect(env.FFMPEG_PATH).toBe("");
    expect(env.CAPTCHA_PROVIDER).toBe("none");
    expect(env.EMAIL_PROVIDER).toBe("console");
  });

  it("rejects a missing database URL", () => {
    expect(() => parseApiEnv({ REDIS_URL: "redis://localhost:6379", ...secrets })).toThrow();
  });

  it("rejects a fixed development OTP in production", () => {
    expect(() =>
      parseApiEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://hasut:hasut@localhost:5432/hasut",
        REDIS_URL: "redis://localhost:6379",
        OTP_PROVIDER: "msg91",
        MEDIA_STORAGE: "s3",
        DEV_OTP_CODE: "123456",
        ...secrets,
      }),
    ).toThrow(/DEV_OTP_CODE is forbidden in production/);
  });

  it("rejects console OTP in production", () => {
    expect(() =>
      parseApiEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://hasut:hasut@localhost:5432/hasut",
        REDIS_URL: "redis://localhost:6379",
        OTP_PROVIDER: "console",
        ...secrets,
      }),
    ).toThrow(/forbidden in production/);
  });

  it("rejects an unprotected sign-in surface in production", () => {
    expect(() =>
      parseApiEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://hasut:hasut@localhost:5432/hasut",
        REDIS_URL: "redis://localhost:6379",
        OTP_PROVIDER: "msg91",
        MEDIA_STORAGE: "s3",
        EMAIL_PROVIDER: "smtp",
        SMTP_URL: "smtp://localhost:1025",
        ...secrets,
      }),
    ).toThrow(/CAPTCHA_PROVIDER=none is forbidden in production/);
  });

  it("requires a reCAPTCHA secret whenever reCAPTCHA is selected", () => {
    expect(() =>
      parseApiEnv({
        DATABASE_URL: "postgresql://hasut:hasut@localhost:5432/hasut",
        REDIS_URL: "redis://localhost:6379",
        CAPTCHA_PROVIDER: "recaptcha",
        ...secrets,
      }),
    ).toThrow(/RECAPTCHA_SECRET_KEY is required/);
  });

  it("requires an SMTP URL whenever SMTP delivery is selected", () => {
    expect(() =>
      parseApiEnv({
        DATABASE_URL: "postgresql://hasut:hasut@localhost:5432/hasut",
        REDIS_URL: "redis://localhost:6379",
        EMAIL_PROVIDER: "smtp",
        ...secrets,
      }),
    ).toThrow(/SMTP_URL is required/);
  });
});

describe("resolveBrowserApiBaseUrl", () => {
  it("uses loopback on the server and for localhost pages", () => {
    expect(resolveBrowserApiBaseUrl("http://localhost:3001", { isBrowser: false })).toBe(
      "http://127.0.0.1:3001",
    );
    expect(
      resolveBrowserApiBaseUrl("http://localhost:3001", {
        isBrowser: true,
        pageOrigin: "http://localhost:3002",
      }),
    ).toBe("http://127.0.0.1:3001");
  });

  it("follows the page hostname on a LAN origin so OTP reaches this machine", () => {
    expect(
      resolveBrowserApiBaseUrl("http://localhost:3001", {
        isBrowser: true,
        pageOrigin: "http://192.168.29.187:3000",
      }),
    ).toBe("http://192.168.29.187:3001");
  });
});

describe("resolveRealtimeApiBaseUrl", () => {
  it("keeps the API port and follows the page hostname on LAN", () => {
    expect(resolveRealtimeApiBaseUrl("http://localhost:3001", "http://192.168.29.187:3000")).toBe(
      "http://192.168.29.187:3001",
    );
    expect(resolveRealtimeApiBaseUrl("http://localhost:3001", "http://localhost:3000")).toBe(
      "http://localhost:3001",
    );
  });
});
