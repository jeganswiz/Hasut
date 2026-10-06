import { nameInitials, nameMarkHue } from "./name-mark";

describe("name mark", () => {
  it("builds initials and a stable angle from a name", () => {
    expect(nameInitials("Corner Filter Cafe")).toBe("CF");
    expect(nameInitials("  ")).toBe("?");
    expect(nameMarkHue("Lotus Wellness Clinic")).toBe(nameMarkHue("Lotus Wellness Clinic"));
    expect(nameMarkHue("Lotus Wellness Clinic")).not.toBe(nameMarkHue("Rohan Das"));
  });
});
