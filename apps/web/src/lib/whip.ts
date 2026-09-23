export interface WhipRequest {
  url: string;
  method: "POST";
  headers: { "Content-Type": "application/sdp" };
  body: string;
}

export interface WhipResponse {
  status: number;
  body: string;
  location: string | null;
}

export interface WhipPeer {
  iceGatheringState: "new" | "gathering" | "complete";
  localDescription: { sdp: string } | null;
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  createOffer(): Promise<{ type: "offer"; sdp?: string }>;
  setLocalDescription(description: { type: "offer"; sdp: string }): Promise<void>;
  setRemoteDescription(description: { type: "answer"; sdp: string }): Promise<void>;
  addEventListener(type: "icegatheringstatechange", listener: () => void): void;
  removeEventListener(type: "icegatheringstatechange", listener: () => void): void;
  close(): void;
}

/**
 * The browser can POST an absolute ingest URL, or a same-origin `/media/whip`
 * path that the web rewrite forwards to MediaMTX.
 */
export function reachableIngestUrl(url: string | null): url is string {
  if (url === null) {
    return false;
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return true;
  }
  return url.startsWith("/media/whip");
}

export function whipOfferRequest(ingestUrl: string, offerSdp: string): WhipRequest {
  if (!reachableIngestUrl(ingestUrl)) {
    throw new Error("Ingest URL is not reachable");
  }
  if (!offerSdp.includes("v=0")) {
    throw new Error("Offer is not SDP");
  }
  return {
    url: ingestUrl,
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: offerSdp,
  };
}

/** WHIP answers are SDP. 201 is the spec; some servers use 200. */
export function readWhipAnswer(status: number, body: string): string {
  if (status !== 201 && status !== 200) {
    throw new Error("Ingest refused the offer");
  }
  const answer = body.trim();
  if (!answer.includes("v=0")) {
    throw new Error("Ingest did not return an answer");
  }
  return answer;
}

/**
 * Session URL from the WHIP Location header. Only a URL on the same origin as
 * the ingest server is kept, so a foreign Location is not requested later.
 */
export function whipResourceUrl(ingestUrl: string, location: string | null): string | null {
  if (!reachableIngestUrl(ingestUrl) || location === null) {
    return null;
  }
  const trimmed = location.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (ingestUrl.startsWith("/media/whip")) {
    return proxiedWhipResource(ingestUrl, trimmed);
  }
  try {
    const base = new URL(ingestUrl);
    const resolved = new URL(trimmed, ingestUrl);
    if (resolved.origin !== base.origin) {
      return null;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function proxiedWhipResource(ingestUrl: string, location: string): string | null {
  try {
    const resolved = new URL(location, `http://hasut.media.invalid${ingestUrl}`);
    if (resolved.hostname === "hasut.media.invalid") {
      return `/media/whip${resolved.pathname}${resolved.search}`;
    }
    if (resolved.hostname !== "127.0.0.1" && resolved.hostname !== "localhost") {
      return null;
    }
    if (resolved.port !== "8889" && resolved.port !== "") {
      return null;
    }
    return `/media/whip${resolved.pathname}${resolved.search}`;
  } catch {
    return null;
  }
}

export function whipEndRequest(
  resourceUrl: string | null,
): { url: string; method: "DELETE" } | null {
  if (!reachableIngestUrl(resourceUrl)) {
    return null;
  }
  return { url: resourceUrl, method: "DELETE" };
}

export function whenIceGathered(peer: WhipPeer, timeoutMs: number): Promise<void> {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      peer.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = (): void => {
      if (peer.iceGatheringState === "complete") {
        finish();
      }
    };
    peer.addEventListener("icegatheringstatechange", onChange);
    const timer = setTimeout(finish, timeoutMs);
  });
}

const ICE_WAIT_MS = 2500;

/**
 * Sends the camera to the owner's WHIP ingest URL. `resourceUrl` is the session
 * to DELETE on end. `close` only closes the peer connection.
 */
export async function publishWhip(input: {
  ingestUrl: string;
  stream: MediaStream;
  createConnection: () => WhipPeer;
  post: (request: WhipRequest) => Promise<WhipResponse>;
}): Promise<{ close: () => void; resourceUrl: string | null }> {
  const peer = input.createConnection();
  try {
    for (const track of input.stream.getTracks()) {
      peer.addTrack(track, input.stream);
    }
    const offer = await peer.createOffer();
    const offerSdp = offer.sdp ?? "";
    await peer.setLocalDescription({ type: "offer", sdp: offerSdp });
    await whenIceGathered(peer, ICE_WAIT_MS);
    const gathered = peer.localDescription?.sdp ?? offerSdp;
    const request = whipOfferRequest(input.ingestUrl, gathered);
    const response = await input.post(request);
    const answer = readWhipAnswer(response.status, response.body);
    await peer.setRemoteDescription({ type: "answer", sdp: answer });
    return {
      close: () => peer.close(),
      resourceUrl: whipResourceUrl(input.ingestUrl, response.location),
    };
  } catch (error) {
    peer.close();
    throw error;
  }
}
