import { createRequestId, isUuidV4, normalizeRequestId } from "./request-id";

describe("request id", () => {
  it("creates a UUID v4", () => {
    expect(isUuidV4(createRequestId())).toBe(true);
  });

  it("keeps a well-formed incoming id", () => {
    expect(normalizeRequestId("abc-123")).toBe("abc-123");
  });

  it("replaces empty incoming ids", () => {
    const generated = normalizeRequestId("   ");
    expect(isUuidV4(generated)).toBe(true);
  });
});
