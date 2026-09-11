import { bucketDistanceMeters, formatDistanceLabel } from "./distance";

describe("formatDistanceLabel", () => {
  it("formats meters and kilometers from configured steps", () => {
    expect(formatDistanceLabel(200)).toBe("200m");
    expect(formatDistanceLabel(1_100)).toBe("1.1km");
    expect(formatDistanceLabel(12_000)).toBe("12km");
  });
});

describe("bucketDistanceMeters", () => {
  it("uses the smallest configured step that covers the distance", () => {
    const steps = [200, 600, 1_100, 5_000];
    expect(bucketDistanceMeters(180, steps)).toBe("200m");
    expect(bucketDistanceMeters(900, steps)).toBe("1.1km");
    expect(bucketDistanceMeters(9_000, steps)).toBe("5km");
  });
});
