import { LOCAL_HLS_ORIGIN, proxyHlsRequest } from "./hls-proxy";

function jsonResponse(
  status: number,
  body: string,
  contentType = "application/vnd.apple.mpegurl",
): typeof fetch {
  return (async () =>
    new Response(body, {
      status,
      headers: { "content-type": contentType },
    })) as typeof fetch;
}

describe("proxyHlsRequest", () => {
  it("forwards a playlist GET to the local MediaMTX origin", async () => {
    const fetchImpl = jest.fn(jsonResponse(200, "#EXTM3U\n"));
    const result = await proxyHlsRequest(
      { method: "GET", path: "stories/s1/index.m3u8", hlsBase: "" },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledWith(`${LOCAL_HLS_ORIGIN}/stories/s1/index.m3u8`, {
      method: "GET",
      redirect: "manual",
    });
    expect(result.status).toBe(200);
    expect(result.contentType).toContain("mpegurl");
    expect(Buffer.from(result.body).toString("utf8")).toContain("#EXTM3U");
  });

  it("refuses a method and a traversal path", async () => {
    const fetchImpl = jest.fn();
    expect(
      (
        await proxyHlsRequest(
          { method: "POST", path: "stories/s1/index.m3u8", hlsBase: "" },
          fetchImpl,
        )
      ).status,
    ).toBe(405);
    expect(
      (await proxyHlsRequest({ method: "GET", path: "../secret", hlsBase: "" }, fetchImpl)).status,
    ).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 502 when MediaMTX is down", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const result = await proxyHlsRequest(
      { method: "GET", path: "live/1/index.m3u8", hlsBase: "http://127.0.0.1:8888" },
      fetchImpl,
    );
    expect(result.status).toBe(502);
  });
});
