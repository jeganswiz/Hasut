import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = [
  "src/app/connections/page.tsx",
  "src/app/inbox/page.tsx",
  "src/app/notifications/page.tsx",
  "src/app/conversations/[id]/page.tsx",
  "src/app/members/[id]/page.tsx",
  "src/app/social.css",
];

describe("web social source", () => {
  it("does not hardcode theme hex values", () => {
    const source = FILES.map((file) =>
      readFileSync(join(__dirname, "..", "..", file), "utf8"),
    ).join("\n");
    expect(source).not.toMatch(/#6D28D9|#EAB308|#7C3AED|#FBBF24/i);
  });
});
