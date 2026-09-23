import { mediaOrigin } from "@hasut/utils";

/**
 * Local MediaMTX is not on the web origin. Relative story/live URLs go through
 * these rewrites so the browser never talks to :8888 / :8889 directly.
 */
export function mediaProxyRewrites(
  hlsBase: string,
  whipBase: string,
): Array<{ source: string; destination: string }> {
  return [
    {
      source: "/media/hls/:path*",
      destination: `${mediaOrigin(hlsBase, "http://127.0.0.1:8888")}/:path*`,
    },
    {
      source: "/media/whip/:path*",
      destination: `${mediaOrigin(whipBase, "http://127.0.0.1:8889")}/:path*`,
    },
  ];
}
