import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin discovery source", () => {
  it("does not hardcode theme hex values", () => {
    const files = [
      "src/components/discovery-settings.tsx",
      "src/components/admin-shell.tsx",
      "src/app/globals.css",
    ];
    const source = files
      .map((file) => readFileSync(join(__dirname, "..", "..", file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/#6D28D9|#EAB308|#7C3AED|#FBBF24/i);
  });
});
