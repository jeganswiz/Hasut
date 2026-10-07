import { createAxiosHttpAdapter, type HasutHttpAdapter } from "@hasut/api-client";
import { isDevTunnelHost, rewriteDevAssetUrl } from "@hasut/config";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rewrite local API URLs inside a JSON payload while the page is on ngrok. */
export function rewriteTunnelPayload(data: unknown, pageOrigin: string): unknown {
  if (typeof data === "string") {
    return rewriteDevAssetUrl(data, pageOrigin);
  }
  if (Array.isArray(data)) {
    return data.map((item) => rewriteTunnelPayload(item, pageOrigin));
  }
  if (isPlainRecord(data)) {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      next[key] = rewriteTunnelPayload(value, pageOrigin);
    }
    return next;
  }
  return data;
}

export function tunnelHttpAdapter(inner: HasutHttpAdapter, pageOrigin: string): HasutHttpAdapter {
  return {
    async request(input) {
      const response = await inner.request({
        ...input,
        headers: {
          ...input.headers,
          "ngrok-skip-browser-warning": "true",
        },
      });
      return {
        status: response.status,
        data: rewriteTunnelPayload(response.data, pageOrigin),
      };
    },
  };
}

export function webTunnelHttpAdapter(pageOrigin: string | undefined): HasutHttpAdapter | undefined {
  if (pageOrigin === undefined) {
    return undefined;
  }
  let hostname: string;
  try {
    hostname = new URL(pageOrigin).hostname;
  } catch {
    return undefined;
  }
  if (!isDevTunnelHost(hostname)) {
    return undefined;
  }
  return tunnelHttpAdapter(createAxiosHttpAdapter(), pageOrigin);
}
