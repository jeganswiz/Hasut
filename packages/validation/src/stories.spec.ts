import { storyCreateSchema, liveStartSchema } from "./stories";

describe("storyCreateSchema", () => {
  it("defaults audience to everyone", () => {
    const parsed = storyCreateSchema.parse({
      kind: "IMAGE",
      imageMediaId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.audience).toBe("EVERYONE");
  });

  it("accepts a Patrons-only post", () => {
    const parsed = storyCreateSchema.parse({
      kind: "IMAGE",
      imageMediaId: "11111111-1111-4111-8111-111111111111",
      audience: "PATRONS",
    });
    expect(parsed.audience).toBe("PATRONS");
  });

  it("rejects overlay without a soundtrack", () => {
    expect(() =>
      storyCreateSchema.parse({
        kind: "VIDEO",
        videoMediaId: "11111111-1111-4111-8111-111111111111",
        originalAudioMode: "OVERLAY",
      }),
    ).toThrow(/layer over the original sound/);
  });
});

describe("liveStartSchema", () => {
  it("defaults title and audience", () => {
    expect(liveStartSchema.parse({})).toEqual({ title: "", audience: "EVERYONE" });
  });

  it("accepts a titled live for Patrons", () => {
    expect(liveStartSchema.parse({ title: "Shop board", audience: "PATRONS" })).toEqual({
      title: "Shop board",
      audience: "PATRONS",
    });
  });
});
