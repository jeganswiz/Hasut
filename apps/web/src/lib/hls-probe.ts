import { isHlsDocument, mediaOrigin, mediaProxyTarget, safeMediaSubpath } from "@hasut/utils";

const LOCAL_HLS_ORIGIN = "http://127.0.0.1:8888";

/**
 * Same-origin check for a relative MediaMTX playlist. The browser fetches this
 * instead of the playlist, so a missing stream does not log a 404.
 */
export function hlsProbeUrl(playlistUrl: string): string | null {
  if (!playlistUrl.startsWith("/media/hls/")) {
    return null;
  }
  return `/media/hls-probe?src=${encodeURIComponent(playlistUrl)}`;
}

export function hlsProbeTarget(src: string, hlsBase: string): string | null {
  if (!src.startsWith("/media/hls/")) {
    return null;
  }
  const path = src.slice("/media/hls/".length).split("?")[0] ?? "";
  const subpath = safeMediaSubpath(path);
  if (subpath === null) {
    return null;
  }
  return mediaProxyTarget(mediaOrigin(hlsBase, LOCAL_HLS_ORIGIN), subpath);
}

/** Always answers 200 when the origin can be asked, including a missing playlist. */
export async function readHlsProbe(
  src: string,
  hlsBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; ready: boolean }> {
  const target = hlsProbeTarget(src, hlsBase);
  if (target === null) {
    return { status: 400, ready: false };
  }
  try {
    const upstream = await fetchImpl(target, { method: "GET", redirect: "manual" });
    const body = upstream.status === 200 ? await upstream.text() : "";
    return { status: 200, ready: isHlsDocument(upstream.status, body) };
  } catch {
    return { status: 200, ready: false };
  }
}
