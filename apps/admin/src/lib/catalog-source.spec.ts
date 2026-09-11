import { readFileSync } from "node:fs";
import { join } from "node:path";

const FRONTEND_FILES = ["src/app/categories/page.tsx", "src/components/category-manager.tsx"];

describe("admin catalog source", () => {
  it("does not hardcode seeded category names", () => {
    const source = FRONTEND_FILES.map((file) =>
      readFileSync(join(__dirname, "..", "..", file), "utf8"),
    ).join("\n");
    expect(source).not.toMatch(/Plumbing|Electrical|Tutoring|Fitness training/);
  });
});
