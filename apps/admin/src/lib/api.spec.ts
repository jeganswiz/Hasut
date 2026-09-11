import { ADMIN_SURFACE, adminApiBaseUrl } from "./api";

describe("admin surface", () => {
  it("identifies the admin web app", () => {
    expect(ADMIN_SURFACE).toBe("admin-web");
  });

  it("points server-side clients at loopback instead of localhost", () => {
    const previous = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    try {
      expect(adminApiBaseUrl()).toBe("http://127.0.0.1:3001");
    } finally {
      process.env.NEXT_PUBLIC_API_URL = previous;
    }
  });
});
