import { PROFESSIONAL_AVAILABILITY_DEFAULTS, isAvailabilityOptions } from "./professional";

describe("professional availability config", () => {
  it("accepts the seeded default options", () => {
    expect(isAvailabilityOptions(PROFESSIONAL_AVAILABILITY_DEFAULTS)).toBe(true);
  });

  it("rejects an empty catalog", () => {
    expect(isAvailabilityOptions([])).toBe(false);
  });
});
