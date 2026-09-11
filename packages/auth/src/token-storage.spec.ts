import { createMemoryTokenStorage } from "./token-storage";

describe("createMemoryTokenStorage", () => {
  it("stores and clears a session", async () => {
    const storage = createMemoryTokenStorage();
    await storage.setSession({ accessToken: "a", refreshToken: "r" });
    expect(await storage.getAccessToken()).toBe("a");
    expect(await storage.getRefreshToken()).toBe("r");
    await storage.clear();
    expect(await storage.getAccessToken()).toBeNull();
  });
});
