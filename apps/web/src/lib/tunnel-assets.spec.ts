import type { HasutHttpAdapter } from "@hasut/api-client";
import { rewriteTunnelPayload, tunnelHttpAdapter, webTunnelHttpAdapter } from "./tunnel-assets";

describe("rewriteTunnelPayload", () => {
  it("rewrites nested local API URLs and leaves other fields", () => {
    expect(
      rewriteTunnelPayload(
        {
          photoUrl: "http://127.0.0.1:3001/api/v1/media/files/a.jpg",
          items: [{ photoUrl: "https://cdn.example/b.jpg" }],
        },
        "https://hasut-demo.ngrok-free.app",
      ),
    ).toEqual({
      photoUrl: "https://hasut-demo.ngrok-free.app/api/v1/media/files/a.jpg",
      items: [{ photoUrl: "https://cdn.example/b.jpg" }],
    });
  });
});

describe("tunnelHttpAdapter", () => {
  it("sends the ngrok browser-warning header and rewrites the body", async () => {
    const seen: Array<Record<string, string>> = [];
    const inner: HasutHttpAdapter = {
      async request(input) {
        seen.push(input.headers);
        return {
          status: 200,
          data: { photoUrl: "http://127.0.0.1:3001/api/v1/media/files/a.jpg" },
        };
      },
    };
    const adapter = tunnelHttpAdapter(inner, "https://hasut-demo.ngrok-free.app");
    const response = await adapter.request({
      url: "https://hasut-demo.ngrok-free.app/api/v1/me",
      method: "GET",
      headers: { accept: "application/json" },
    });
    expect(seen).toEqual([{ accept: "application/json", "ngrok-skip-browser-warning": "true" }]);
    expect(response.data).toEqual({
      photoUrl: "https://hasut-demo.ngrok-free.app/api/v1/media/files/a.jpg",
    });
  });
});

describe("webTunnelHttpAdapter", () => {
  it("stays off for localhost and turns on for an ngrok origin", () => {
    expect(webTunnelHttpAdapter(undefined)).toBeUndefined();
    expect(webTunnelHttpAdapter("http://localhost:3000")).toBeUndefined();
    const adapter = webTunnelHttpAdapter("https://hasut-demo.ngrok-free.app");
    expect(adapter).toBeDefined();
    expect(typeof adapter?.request).toBe("function");
  });
});
