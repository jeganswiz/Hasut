import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin discovery source", () => {
  it("does not hardcode theme hex values", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "src/components/discovery-settings.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/#6D28D9|#EAB308|#7C3AED|#FBBF24/i);
  });
});
