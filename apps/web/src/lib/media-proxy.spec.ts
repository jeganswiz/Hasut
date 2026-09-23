import { mediaProxyRewrites } from "./media-proxy";

describe("mediaProxyRewrites", () => {
  it("forwards relative HLS and WHIP paths to the local MediaMTX ports", () => {
    expect(mediaProxyRewrites("", "")).toEqual([
      { source: "/media/hls/:path*", destination: "http://127.0.0.1:8888/:path*" },
      { source: "/media/whip/:path*", destination: "http://127.0.0.1:8889/:path*" },
    ]);
  });

  it("uses the configured origins when they are set", () => {
    expect(mediaProxyRewrites("http://media.example:8888/", "http://media.example:8889")).toEqual([
      { source: "/media/hls/:path*", destination: "http://media.example:8888/:path*" },
      { source: "/media/whip/:path*", destination: "http://media.example:8889/:path*" },
    ]);
  });
});
