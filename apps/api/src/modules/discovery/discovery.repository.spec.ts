import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("DiscoveryRepository", () => {
  it("keeps geographic filtering in PostGIS SQL", () => {
    const source = readFileSync(join(__dirname, "discovery.repository.ts"), "utf8");
    expect(source).toContain("ST_DWithin");
    expect(source).toContain("ST_Distance");
    expect(source).toContain("ST_SetSRID(ST_MakePoint");
    expect(source).not.toMatch(/haversineMeters/);
    expect(source).not.toMatch(/findMany\(\s*\{\s*\}\s*\)/);
  });
});
