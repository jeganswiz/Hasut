/**
 * MediaMTX path layout. HLS and WHIP are different ports, so they are separate
 * origins. A missing base stays a relative path for local setups that proxy it.
 */
export function storyPlaybackUrls(
  storyId: string,
  hlsBase: string,
): { hlsUrl: string; previewHlsUrl: string } {
  const playlist = `${origin(hlsBase, "/media/hls")}/stories/${storyId}/index.m3u8`;
  // One playlist until a separate 240p rendition exists. The map stays muted.
  return { hlsUrl: playlist, previewHlsUrl: playlist };
}

export function livePlaybackUrls(
  liveId: string,
  hlsBase: string,
  whipBase: string,
): { hlsUrl: string; previewHlsUrl: string; ingestUrl: string } {
  const playlist = `${origin(hlsBase, "/media/hls")}/live/${liveId}/index.m3u8`;
  return {
    hlsUrl: playlist,
    previewHlsUrl: playlist,
    ingestUrl: `${origin(whipBase, "/media/whip")}/live/${liveId}/whip`,
  };
}

function origin(base: string, fallback: string): string {
  const trimmed = base.trim().replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed : fallback;
}
