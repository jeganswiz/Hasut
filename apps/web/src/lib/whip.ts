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

const MEDIA_DIRECTION = new Set(["a=recvonly", "a=sendonly", "a=sendrecv", "a=inactive"]);

/**
 * MediaMTX places `a=recvonly` after the rtpmap block and emits
 * `a=msid-semantic:WMS*` plus trailing spaces. Chromium then rejects the
 * answer (`a=recvonly` is reported as an invalid line) and the composer
 * would end the live session. Direction is moved to just after `a=mid`.
 */
export function normalizeWhipAnswer(sdp: string): string {
  const lines = sdp
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line === "a=msid-semantic:WMS*" ? "a=msid-semantic: WMS *" : line));
  const sections: string[][] = [];
  for (const line of lines) {
    if (line.startsWith("m=") || sections.length === 0) {
      sections.push([line]);
      continue;
    }
    const current = sections[sections.length - 1];
    if (current !== undefined) {
      current.push(line);
    }
  }
  const rendered = sections.map((section) => placeMediaDirection(section));
  return `${rendered.flat().join("\r\n")}\r\n`;
}

function placeMediaDirection(section: string[]): string[] {
  const first = section[0];
  if (first === undefined || !first.startsWith("m=")) {
    return section;
  }
  const direction = section.find((line) => MEDIA_DIRECTION.has(line));
  const rest = section.filter((line) => !MEDIA_DIRECTION.has(line));
  if (direction === undefined) {
    return rest;
  }
  const midIndex = rest.findIndex((line) => line.startsWith("a=mid:"));
  const insertAt = midIndex === -1 ? 1 : midIndex + 1;
  rest.splice(insertAt, 0, direction);
  return rest;
}

/** HLS remux drops VP8. Putting H264 first lets MediaMTX publish a playable video track. */
export function videoCodecsH264First<T extends { mimeType: string }>(codecs: readonly T[]): T[] {
  const h264: T[] = [];
  const rest: T[] = [];
  for (const codec of codecs) {
    if (codec.mimeType.toLowerCase() === "video/h264") {
      h264.push(codec);
    } else {
      rest.push(codec);
    }
  }
  return h264.length === 0 ? [...codecs] : [...h264, ...rest];
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

interface ConnectablePeer {
  connectionState: string;
  addEventListener(type: "connectionstatechange", listener: () => void): void;
  removeEventListener(type: "connectionstatechange", listener: () => void): void;
}

function connectablePeer(peer: WhipPeer): ConnectablePeer | null {
  if (!("connectionState" in peer)) {
    return null;
  }
  if (typeof (peer as { connectionState?: unknown }).connectionState !== "string") {
    return null;
  }
  // RTCPeerConnection reports connectionState; the WhipPeer test double does not.
  return peer as unknown as ConnectablePeer;
}

/** Resolves once ICE is up. Peers without a connection state (tests) skip the wait. */
export function whenPeerConnected(peer: WhipPeer, timeoutMs: number): Promise<void> {
  const connectable = connectablePeer(peer);
  if (connectable === null) {
    return Promise.resolve();
  }
  if (connectable.connectionState === "connected") {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (connected: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      connectable.removeEventListener("connectionstatechange", onChange);
      clearTimeout(timer);
      if (connected) {
        resolve();
        return;
      }
      reject(new Error("Camera did not connect to the live server"));
    };
    const onChange = (): void => {
      if (connectable.connectionState === "connected") {
        finish(true);
        return;
      }
      if (connectable.connectionState === "failed" || connectable.connectionState === "closed") {
        finish(false);
      }
    };
    connectable.addEventListener("connectionstatechange", onChange);
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

const ICE_WAIT_MS = 2500;
const CONNECT_WAIT_MS = 12000;

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
    preferH264(peer);
    const offer = await peer.createOffer();
    const offerSdp = offer.sdp ?? "";
    await peer.setLocalDescription({ type: "offer", sdp: offerSdp });
    await whenIceGathered(peer, ICE_WAIT_MS);
    const gathered = peer.localDescription?.sdp ?? offerSdp;
    const request = whipOfferRequest(input.ingestUrl, gathered);
    const response = await input.post(request);
    const answer = normalizeWhipAnswer(readWhipAnswer(response.status, response.body));
    await peer.setRemoteDescription({ type: "answer", sdp: answer });
    await whenPeerConnected(peer, CONNECT_WAIT_MS);
    return {
      close: () => peer.close(),
      resourceUrl: whipResourceUrl(input.ingestUrl, response.location),
    };
  } catch (error) {
    peer.close();
    throw error;
  }
}

interface CodecTransceiver {
  sender: { track: { kind: string } | null };
  setCodecPreferences(codecs: ReadonlyArray<{ mimeType: string }>): void;
}

function hasTransceivers(
  peer: WhipPeer,
): peer is WhipPeer & { getTransceivers(): CodecTransceiver[] } {
  return (
    "getTransceivers" in peer &&
    typeof (peer as { getTransceivers?: unknown }).getTransceivers === "function"
  );
}

function preferH264(peer: WhipPeer): void {
  if (typeof RTCRtpSender === "undefined" || typeof RTCRtpSender.getCapabilities !== "function") {
    return;
  }
  if (!hasTransceivers(peer)) {
    return;
  }
  const capabilities = RTCRtpSender.getCapabilities("video");
  if (capabilities === null) {
    return;
  }
  const ordered = videoCodecsH264First(capabilities.codecs);
  for (const transceiver of peer.getTransceivers()) {
    if (transceiver.sender.track?.kind !== "video") {
      continue;
    }
    try {
      transceiver.setCodecPreferences(ordered);
    } catch {
      return;
    }
  }
}
