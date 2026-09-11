import { slugify } from "./strings";

describe("slugify", () => {
  it("turns a category name into a unique-friendly slug", () => {
    expect(slugify("Home services")).toBe("home-services");
    expect(slugify("  Language coaching  ")).toBe("language-coaching");
  });
});
