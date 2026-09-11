import { WEB_SURFACE, webApiBaseUrl } from "./api";

describe("web surface", () => {
  it("identifies the member web app", () => {
    expect(WEB_SURFACE).toBe("member-web");
  });

  it("points server-side clients at loopback instead of localhost", () => {
    const previous = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    try {
      expect(webApiBaseUrl()).toBe("http://127.0.0.1:3001");
    } finally {
      process.env.NEXT_PUBLIC_API_URL = previous;
    }
  });
});
