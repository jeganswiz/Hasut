/**
 * MediaMTX-shaped HLS origin for Playwright. Paths match
 * /live/{id}/index.m3u8 — the same layout the web rewrite forwards.
 */
import { createServer } from "node:http";
import process from "node:process";

const PORT = Number(process.env.HASUT_E2E_HLS_PORT ?? 18888);
const PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXTINF:2.0,
e2e.ts
#EXT-X-ENDLIST
`;

const server = createServer((request, response) => {
  const path = request.url?.split("?")[0] ?? "";
  if (path === "/health") {
    response.writeHead(200, { "content-type": "text/plain", "x-hasut-hls": "fixture" });
    response.end("ok");
    return;
  }
  if (path === "/live/e2e-ready/index.m3u8") {
    response.writeHead(200, {
      "content-type": "application/vnd.apple.mpegurl",
      "access-control-allow-origin": "*",
    });
    response.end(PLAYLIST);
    return;
  }
  response.writeHead(404, { "access-control-allow-origin": "*" });
  response.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`hasut-hls-origin ${PORT}\n`);
});
