import { fail, isApiEnvelope, ok } from "./api";

describe("API envelope", () => {
  it("builds a success envelope", () => {
    const body = ok({ alive: true }, "req-1");
    expect(body.success).toBe(true);
    expect(body.data.alive).toBe(true);
    expect(body.meta.requestId).toBe("req-1");
    expect(isApiEnvelope(body)).toBe(true);
  });

  it("builds a failure envelope without details when omitted", () => {
    const body = fail("NOT_FOUND", "Missing", "req-2");
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.details).toBeUndefined();
  });
});
