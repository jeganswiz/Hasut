import { readFileSync } from "node:fs";
import { join } from "node:path";

const FRONTEND_FILES = [
  "src/components/discovery-experience.tsx",
  "src/components/discovery-map.tsx",
  "src/components/app-nav.tsx",
  "src/components/search-suggest.tsx",
  "src/components/nav-icons.tsx",
  "src/components/native-scroller.tsx",
  "src/components/toast-stack.tsx",
  "src/lib/use-discovery-map.ts",
  "src/lib/discovery-chrome.ts",
  "src/app/discovery.css",
  "src/app/globals.css",
];

describe("web discovery source", () => {
  it("does not hardcode theme hex or seeded category names", () => {
    const source = FRONTEND_FILES.map((file) =>
      readFileSync(join(__dirname, "..", "..", file), "utf8"),
    ).join("\n");
    expect(source).not.toMatch(/#6D28D9|#EAB308|#7C3AED|#FBBF24/i);
    expect(source).not.toMatch(/Plumbing|Electrical|Tutoring|Fitness training/);
  });
});
