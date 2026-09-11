import { healthDataSchema } from "./api";

describe("healthDataSchema", () => {
  it("accepts a healthy payload", () => {
    const parsed = healthDataSchema.parse({
      status: "ok",
      scope: "ready",
      service: "hasut-api",
      version: "0.0.0",
      uptimeSeconds: 1,
      checks: { postgres: "up", postgis: "up", redis: "up" },
    });
    expect(parsed.status).toBe("ok");
  });

  it("rejects an incomplete probe set", () => {
    const result = healthDataSchema.safeParse({
      status: "ok",
      scope: "ready",
      service: "hasut-api",
      version: "0.0.0",
      uptimeSeconds: 1,
      checks: { postgres: "up" },
    });
    expect(result.success).toBe(false);
  });
});
