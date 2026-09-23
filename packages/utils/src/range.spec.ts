import { formatClock, moveHandle, normalizeRange, type RangeBounds } from "./range";

const BOUNDS: RangeBounds = { duration: 60, maxSpan: 30, minSpan: 1 };

describe("moveHandle", () => {
  it("moves the start handle and leaves a valid range", () => {
    expect(moveHandle({ start: 0, end: 10 }, "start", 4, BOUNDS)).toEqual({ start: 4, end: 10 });
  });

  it("pushes the end handle instead of inverting the range", () => {
    expect(moveHandle({ start: 0, end: 10 }, "start", 15, BOUNDS)).toEqual({ start: 15, end: 16 });
  });

  it("pushes the start handle when the end is dragged past it", () => {
    expect(moveHandle({ start: 20, end: 40 }, "end", 12, BOUNDS)).toEqual({ start: 11, end: 12 });
  });

  it("never lets the selection exceed the maximum span", () => {
    const moved = moveHandle({ start: 0, end: 10 }, "end", 60, BOUNDS);
    expect(moved.end - moved.start).toBeLessThanOrEqual(BOUNDS.maxSpan);
  });

  it("keeps the start inside the clip when the maximum span shrinks the window", () => {
    const moved = moveHandle({ start: 0, end: 50 }, "end", 50, BOUNDS);
    expect(moved).toEqual({ start: 20, end: 50 });
  });

  it("clamps a handle dragged below zero", () => {
    expect(moveHandle({ start: 5, end: 20 }, "start", -8, BOUNDS)).toEqual({ start: 0, end: 20 });
  });

  it("clamps to the source end and drags the start along to respect the span", () => {
    expect(moveHandle({ start: 5, end: 20 }, "end", 900, BOUNDS)).toEqual({ start: 30, end: 60 });
  });

  it("collapses to the whole source when it is shorter than the minimum span", () => {
    expect(
      moveHandle({ start: 0, end: 0 }, "end", 5, { duration: 1, maxSpan: 30, minSpan: 3 }),
    ).toEqual({
      start: 0,
      end: 1,
    });
  });

  it("rounds fractional drag positions to whole seconds", () => {
    expect(moveHandle({ start: 0, end: 10 }, "start", 3.7, BOUNDS)).toEqual({ start: 4, end: 10 });
  });
});

describe("normalizeRange", () => {
  it("fits an out-of-bounds selection once a source reports its duration", () => {
    const fitted = normalizeRange({ start: 0, end: 90 }, BOUNDS);
    expect(fitted.start).toBeGreaterThanOrEqual(0);
    expect(fitted.end).toBeLessThanOrEqual(BOUNDS.duration);
    expect(fitted.end - fitted.start).toBeLessThanOrEqual(BOUNDS.maxSpan);
  });
});

describe("formatClock", () => {
  it("pads seconds", () => {
    expect(formatClock(7)).toBe("0:07");
  });

  it("carries into minutes", () => {
    expect(formatClock(75)).toBe("1:15");
  });

  it("floors a negative to zero", () => {
    expect(formatClock(-4)).toBe("0:00");
  });
});
