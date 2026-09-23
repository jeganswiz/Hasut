/** Trim a configured origin or fall back to the local MediaMTX port. */
export function mediaOrigin(base: string, fallback: string): string {
  const trimmed = base.trim().replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * A MediaMTX subpath only. Rejects traversal, schemes, and empty segments so
 * the API proxy cannot be pointed at an arbitrary host.
 */
export function safeMediaSubpath(path: string): string | null {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.length === 0) {
    return null;
  }
  const parts = normalized.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(normalized)) {
    return null;
  }
  return parts.join("/");
}

export function mediaProxyTarget(origin: string, subpath: string, search = ""): string {
  const query = search.startsWith("?") || search.length === 0 ? search : `?${search}`;
  return `${origin.replace(/\/$/, "")}/${subpath}${query}`;
}

/**
 * A phone cannot use a Next rewrite. Prefix a relative `/media/` path with the
 * API origin so it hits the Nest HLS proxy.
 */
export function resolveMediaUrl(url: string | null, apiOrigin: string): string | null {
  if (url === null) {
    return null;
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url;
  }
  if (!url.startsWith("/media/hls")) {
    return null;
  }
  const origin = apiOrigin.trim().replace(/\/$/, "");
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    return null;
  }
  return `${origin}${url}`;
}
