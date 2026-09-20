import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("expo sdk", () => {
  it("targets SDK 57 so current Expo Go can open the project", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      dependencies: { expo: string; "react-native": string };
    };
    expect(pkg.dependencies.expo).toMatch(/^~57\./);
    expect(pkg.dependencies["react-native"]).toBe("0.86.3");
  });
});
