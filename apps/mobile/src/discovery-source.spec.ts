import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("mobile discovery source", () => {
  it("does not hardcode theme hex or seeded category names", () => {
    const source = readFileSync(join(__dirname, "discovery.tsx"), "utf8");
    expect(source).not.toMatch(/#6D28D9|#EAB308|#7C3AED|#FBBF24/i);
    expect(source).not.toMatch(/Plumbing|Electrical|Tutoring|Fitness training/);
    expect(source).toContain("usePickedPinPreviewUrls");
    expect(source).toContain("ownerPresenceCopy");
  });
});
