import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("expo sdk", () => {
  it("targets SDK 57 so current Expo Go can open the project", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      dependencies: {
        expo: string;
        "react-native": string;
        "expo-audio": string;
        "expo-image-picker": string;
        "expo-network": string;
        "expo-video": string;
      };
    };
    expect(pkg.dependencies.expo).toMatch(/^~57\./);
    expect(pkg.dependencies["expo-audio"]).toMatch(/^~57\./);
    expect(pkg.dependencies["expo-network"]).toMatch(/^~57\./);
    expect(pkg.dependencies["expo-image-picker"]).toMatch(/^~57\./);
    expect(pkg.dependencies["expo-video"]).toMatch(/^~57\./);
    expect(pkg.dependencies["react-native"]).toBe("0.86.3");
    const app = JSON.parse(readFileSync(join(__dirname, "..", "app.json"), "utf8")) as {
      expo: { plugins: Array<string | [string, Record<string, unknown>]> };
    };
    expect(app.expo.plugins).toContain("expo-video");
    expect(
      app.expo.plugins.some(
        (plugin) =>
          plugin === "expo-audio" || (Array.isArray(plugin) && plugin[0] === "expo-audio"),
      ),
    ).toBe(true);
  });
});
