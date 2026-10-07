import { isHlsDocument } from "@hasut/utils";
import { hlsProbeUrl } from "./hls-probe";

export {
  HLS_PLAYLIST_POLL_MS as LIVE_PLAYLIST_POLL_MS,
  isHlsDocument as isLivePlaylist,
} from "@hasut/utils";

/** True when the playlist is HLS. Relative MediaMTX URLs are checked without a 404. */
export async function playlistIsReady(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const probe = hlsProbeUrl(url);
  if (probe === null) {
    const response = await fetchImpl(url);
    const body = response.ok ? await response.text() : "";
    return isHlsDocument(response.status, body);
  }
  const response = await fetchImpl(probe);
  if (!response.ok) {
    return false;
  }
  const body: unknown = await response.json();
  return probeSaysReady(body);
}

function probeSaysReady(body: unknown): boolean {
  return typeof body === "object" && body !== null && "ready" in body && body.ready === true;
}
