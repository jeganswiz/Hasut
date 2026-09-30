import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("web PWA source", () => {
  it("does not let the service worker cache API or media paths", () => {
    const script = readFileSync(join(__dirname, "..", "..", "public", "sw.js"), "utf8");
    expect(script).toContain('url.pathname.startsWith("/api/")');
    expect(script).toContain('url.pathname.startsWith("/media/")');
    expect(script).toContain("navigate");
    expect(script).not.toMatch(/#6D28D9|#EAB308/i);
  });
});
