import { isCompactDiscovery, nearestSheetSnap, sheetHeight, snapAfterDrag } from "./sheet-snap";

describe("discovery sheet snaps", () => {
  it("maps peek, half, and expanded to viewport fractions", () => {
    expect(sheetHeight("peek", 800)).toBe(176);
    expect(sheetHeight("half", 800)).toBe(384);
    expect(sheetHeight("expanded", 800)).toBe(656);
  });

  it("snaps a dragged height to the nearest stop", () => {
    expect(nearestSheetSnap(180, 800)).toBe("peek");
    expect(nearestSheetSnap(400, 800)).toBe("half");
    expect(nearestSheetSnap(700, 800)).toBe("expanded");
  });

  it("moves one stop when the handle is dragged far enough", () => {
    expect(snapAfterDrag("half", -80)).toBe("expanded");
    expect(snapAfterDrag("half", 80)).toBe("peek");
    expect(snapAfterDrag("half", 10)).toBe("half");
  });

  it("uses the overlay sheet on compact viewports", () => {
    expect(isCompactDiscovery(390)).toBe(true);
    expect(isCompactDiscovery(860)).toBe(false);
  });
});
