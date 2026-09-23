import { mediaOrigin, mediaProxyTarget, safeMediaSubpath } from "@hasut/utils";
import type { Request, Response } from "express";

export const LOCAL_HLS_ORIGIN = "http://127.0.0.1:8888";

export async function proxyHlsRequest(
  input: {
    method: string;
    path: string;
    search?: string;
    hlsBase: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; contentType: string | null; body: Uint8Array }> {
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return { status: 405, contentType: null, body: new Uint8Array() };
  }
  const subpath = safeMediaSubpath(input.path);
  if (subpath === null) {
    return { status: 400, contentType: null, body: new Uint8Array() };
  }
  const target = mediaProxyTarget(
    mediaOrigin(input.hlsBase, LOCAL_HLS_ORIGIN),
    subpath,
    input.search ?? "",
  );
  try {
    const upstream = await fetchImpl(target, { method, redirect: "manual" });
    const body =
      method === "HEAD" ? new Uint8Array() : new Uint8Array(await upstream.arrayBuffer());
    return {
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      body,
    };
  } catch {
    return { status: 502, contentType: null, body: new Uint8Array() };
  }
}

export function createHlsProxyMiddleware(
  hlsBase: string,
  fetchImpl: typeof fetch = fetch,
): (req: Request, res: Response) => void {
  return (req, res) => {
    void proxyHlsRequest(
      {
        method: req.method,
        path: req.path,
        search: req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "",
        hlsBase,
      },
      fetchImpl,
    ).then((result) => {
      res.status(result.status);
      if (result.contentType !== null) {
        res.setHeader("content-type", result.contentType);
      }
      res.setHeader("cache-control", "no-store");
      res.send(Buffer.from(result.body));
    });
  };
}
