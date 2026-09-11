import { MOBILE_SURFACE } from "./api";

describe("mobile surface", () => {
  it("identifies the member mobile app", () => {
    expect(MOBILE_SURFACE).toBe("member-mobile");
  });
});
