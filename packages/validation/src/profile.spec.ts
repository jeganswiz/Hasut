import { profilePatchSchema, profileWriteSchema } from "./profile";

describe("profile validation", () => {
  it("accepts a create payload", () => {
    const parsed = profileWriteSchema.parse({ displayName: "Jegan", bio: "Builder" });
    expect(parsed.displayName).toBe("Jegan");
    expect(parsed.bio).toBe("Builder");
  });

  it("rejects an empty patch", () => {
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
  });
});
