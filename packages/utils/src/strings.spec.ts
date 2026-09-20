import { initialsFromName, slugify } from "./strings";

describe("slugify", () => {
  it("turns a category name into a unique-friendly slug", () => {
    expect(slugify("Home services")).toBe("home-services");
    expect(slugify("  Language coaching  ")).toBe("language-coaching");
  });
});

describe("initialsFromName", () => {
  it("uses two letters from a display name", () => {
    expect(initialsFromName("Ada Lovelace")).toBe("AL");
    expect(initialsFromName("Ada")).toBe("AD");
    expect(initialsFromName("  ")).toBe("?");
  });
});
