import {
  DEFAULT_PHOTO_ADJUST,
  drawOffset,
  fittedSize,
  isPlainPhoto,
  moveCropBox,
  nextRotation,
  objectPosition,
  resizeCropBox,
} from "./photo-adjust";

describe("photo adjust", () => {
  it("treats the default frame as an unedited photo", () => {
    expect(isPlainPhoto(DEFAULT_PHOTO_ADJUST)).toBe(true);
    expect(isPlainPhoto({ ...DEFAULT_PHOTO_ADJUST, brightness: 110 })).toBe(false);
    expect(isPlainPhoto({ ...DEFAULT_PHOTO_ADJUST, cropW: 80 })).toBe(false);
  });

  it("steps rotation through a full turn", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
    expect(nextRotation(270)).toBe(0);
  });

  it("covers the frame and contains the photo inside it", () => {
    const cover = fittedSize(1080, 1920, 1920, 1080, "cover");
    expect(cover.height).toBe(1920);
    expect(cover.width).toBeCloseTo((1920 * 1920) / 1080, 5);
    expect(fittedSize(1080, 1920, 1080, 1920, "contain")).toEqual({ width: 1080, height: 1920 });
  });

  it("centres a crop when the pan is zero", () => {
    expect(drawOffset(100, 200, 150, 200, 0, 0)).toEqual({ x: -25, y: 0 });
    expect(objectPosition(0, 0)).toBe("50% 50%");
    expect(objectPosition(-100, 100)).toBe("0% 100%");
  });

  it("moves a crop window and keeps it inside the frame", () => {
    expect(moveCropBox({ x: 10, y: 20, w: 40, h: 30 }, 100, -40)).toEqual({
      x: 60,
      y: 0,
      w: 40,
      h: 30,
    });
  });

  it("resizes from the dragged corner", () => {
    const start = { x: 20, y: 20, w: 50, h: 40 };
    expect(resizeCropBox(start, "se", 10, 5)).toEqual({ x: 20, y: 20, w: 60, h: 45 });
    expect(resizeCropBox(start, "nw", 8, 6)).toEqual({ x: 28, y: 26, w: 42, h: 34 });
  });
});
