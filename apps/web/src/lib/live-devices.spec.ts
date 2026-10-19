import { formatLiveClock, healthLabel, mapMediaDevices } from "./live-devices";

describe("mapMediaDevices", () => {
  it("splits cameras and mics and labels untitled devices", () => {
    const mapped = mapMediaDevices([
      { deviceId: "c1", kind: "videoinput", label: "" },
      { deviceId: "m1", kind: "audioinput", label: "Headset" },
      { deviceId: "", kind: "videoinput", label: "ghost" },
    ]);
    expect(mapped.cameras).toEqual([{ id: "c1", label: "Camera 1", kind: "videoinput" }]);
    expect(mapped.mics).toEqual([{ id: "m1", label: "Headset", kind: "audioinput" }]);
  });
});

describe("healthLabel", () => {
  it("maps known states", () => {
    expect(healthLabel("HEALTHY")).toBe("Stream healthy");
    expect(healthLabel("OFFLINE")).toBe("Disconnected");
  });
});

describe("formatLiveClock", () => {
  it("formats elapsed time from the start stamp", () => {
    expect(
      formatLiveClock("2026-10-12T00:00:00.000Z", Date.parse("2026-10-12T00:01:05.000Z")),
    ).toBe("00:01:05");
  });
});
