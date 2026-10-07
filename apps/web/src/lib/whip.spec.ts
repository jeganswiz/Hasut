import {
  normalizeWhipAnswer,
  publishWhip,
  readWhipAnswer,
  reachableIngestUrl,
  videoCodecsH264First,
  whipEndRequest,
  whipOfferRequest,
  whipResourceUrl,
  whenIceGathered,
  whenPeerConnected,
  type WhipPeer,
} from "./whip";

describe("reachableIngestUrl", () => {
  it("accepts absolute ingest URLs and the same-origin MediaMTX rewrite", () => {
    expect(reachableIngestUrl("http://127.0.0.1:8889/live/1/whip")).toBe(true);
    expect(reachableIngestUrl("https://media.example/live/1/whip")).toBe(true);
    expect(reachableIngestUrl("/media/whip/live/1/whip")).toBe(true);
    expect(reachableIngestUrl("/media/hls/live/1/index.m3u8")).toBe(false);
    expect(reachableIngestUrl(null)).toBe(false);
  });
});

describe("whipOfferRequest", () => {
  it("posts the offer as SDP", () => {
    expect(whipOfferRequest("http://127.0.0.1:8889/live/1/whip", "v=0\r\noffer")).toEqual({
      url: "http://127.0.0.1:8889/live/1/whip",
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: "v=0\r\noffer",
    });
  });

  it("refuses a playlist path and a body that is not SDP", () => {
    expect(() => whipOfferRequest("/media/hls/live/1/index.m3u8", "v=0")).toThrow("not reachable");
    expect(() => whipOfferRequest("http://127.0.0.1:8889/live/1/whip", "hello")).toThrow("not SDP");
  });
});

describe("readWhipAnswer", () => {
  it("accepts a 201 SDP answer", () => {
    expect(readWhipAnswer(201, "v=0\r\nanswer\n")).toBe("v=0\r\nanswer");
  });

  it("refuses a non-SDP body", () => {
    expect(() => readWhipAnswer(201, "ok")).toThrow("did not return an answer");
    expect(() => readWhipAnswer(404, "v=0")).toThrow("refused");
  });
});

describe("whenIceGathered", () => {
  it("returns immediately once gathering is already complete", async () => {
    const peer = fakePeer();
    peer.iceGatheringState = "complete";
    await expect(whenIceGathered(peer, 20)).resolves.toBeUndefined();
  });

  it("continues when gathering does not finish in time", async () => {
    jest.useFakeTimers();
    const peer = fakePeer();
    const pending = whenIceGathered(peer, 20);
    jest.advanceTimersByTime(20);
    await expect(pending).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});

describe("whipResourceUrl", () => {
  it("resolves a same-origin Location and drops a foreign one", () => {
    const ingest = "http://127.0.0.1:8889/live/1/whip";
    expect(whipResourceUrl(ingest, "/live/1/session")).toBe("http://127.0.0.1:8889/live/1/session");
    expect(whipResourceUrl(ingest, "https://evil.example/live/1")).toBeNull();
    expect(whipResourceUrl(ingest, null)).toBeNull();
    expect(whipEndRequest(null)).toBeNull();
  });

  it("keeps a proxied session on the /media/whip rewrite", () => {
    const ingest = "/media/whip/live/1/whip";
    expect(whipResourceUrl(ingest, "/live/1/session")).toBe("/media/whip/live/1/session");
    expect(whipResourceUrl(ingest, "http://127.0.0.1:8889/live/1/whip")).toBe(
      "/media/whip/live/1/whip",
    );
    expect(whipResourceUrl(ingest, "https://evil.example/live/1")).toBeNull();
  });
});

describe("normalizeWhipAnswer", () => {
  it("moves recvonly to just after mid so Chromium accepts the answer", () => {
    const answer = [
      "v=0",
      "a=msid-semantic:WMS*",
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=setup:active",
      "a=mid:0",
      "a=rtpmap:96 VP8/90000",
      "a=rtcp-fb:96 nack ",
      "a=recvonly",
    ].join("\n");
    expect(normalizeWhipAnswer(answer)).toBe(
      [
        "v=0",
        "a=msid-semantic: WMS *",
        "m=video 9 UDP/TLS/RTP/SAVPF 96",
        "a=setup:active",
        "a=mid:0",
        "a=recvonly",
        "a=rtpmap:96 VP8/90000",
        "a=rtcp-fb:96 nack",
      ].join("\r\n") + "\r\n",
    );
  });
});

describe("videoCodecsH264First", () => {
  it("puts H264 ahead of the other video codecs", () => {
    expect(
      videoCodecsH264First([
        { mimeType: "video/VP8" },
        { mimeType: "video/H264" },
        { mimeType: "video/rtx" },
      ]),
    ).toEqual([{ mimeType: "video/H264" }, { mimeType: "video/VP8" }, { mimeType: "video/rtx" }]);
  });
});

describe("whenPeerConnected", () => {
  it("skips peers that do not report a connection state", async () => {
    await expect(whenPeerConnected(fakePeer(), 20)).resolves.toBeUndefined();
  });

  it("rejects when the camera never connects", async () => {
    jest.useFakeTimers();
    const peer = connectable("connecting");
    const pending = whenPeerConnected(peer, 30);
    jest.advanceTimersByTime(30);
    await expect(pending).rejects.toThrow("did not connect");
    jest.useRealTimers();
  });

  it("resolves when the connection opens", async () => {
    const peer = connectable("connecting");
    const pending = whenPeerConnected(peer, 1000);
    peer.connectionState = "connected";
    peer.emit();
    await expect(pending).resolves.toBeUndefined();
  });
});

describe("publishWhip", () => {
  it("posts the gathered offer and applies the answer", async () => {
    const peer = fakePeer();
    peer.iceGatheringState = "complete";
    const posted: string[] = [];
    const handle = await publishWhip({
      ingestUrl: "http://127.0.0.1:8889/live/1/whip",
      stream: fakeStream(),
      createConnection: () => peer,
      post: async (request) => {
        posted.push(request.body);
        return { status: 201, body: "v=0\r\nanswer", location: "/live/1/session" };
      },
    });
    expect(posted).toEqual(["v=0\r\ngathered"]);
    expect(peer.remote).toBe("v=0\r\nanswer\r\n");
    expect(peer.tracks).toHaveLength(2);
    expect(handle.resourceUrl).toBe("http://127.0.0.1:8889/live/1/session");
    expect(whipEndRequest(handle.resourceUrl)).toEqual({
      url: "http://127.0.0.1:8889/live/1/session",
      method: "DELETE",
    });
    handle.close();
    expect(peer.closed).toBe(true);
  });

  it("applies a normalized answer when recvonly is after the rtpmap block", async () => {
    const peer = fakePeer();
    peer.iceGatheringState = "complete";
    const raw = [
      "v=0",
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=mid:0",
      "a=rtpmap:96 VP8/90000",
      "a=recvonly",
    ].join("\r\n");
    await publishWhip({
      ingestUrl: "http://127.0.0.1:8889/live/1/whip",
      stream: fakeStream(),
      createConnection: () => peer,
      post: async () => ({ status: 201, body: raw, location: null }),
    });
    expect(peer.remote).toBe(normalizeWhipAnswer(raw));
    expect(peer.remote?.indexOf("a=recvonly")).toBeLessThan(peer.remote?.indexOf("a=rtpmap") ?? 0);
  });

  it("closes the peer connection when ingest refuses the offer", async () => {
    const peer = fakePeer();
    peer.iceGatheringState = "complete";
    await expect(
      publishWhip({
        ingestUrl: "http://127.0.0.1:8889/live/1/whip",
        stream: fakeStream(),
        createConnection: () => peer,
        post: async () => ({ status: 404, body: "missing", location: null }),
      }),
    ).rejects.toThrow("refused");
    expect(peer.closed).toBe(true);
  });
});

function connectable(initial: string): WhipPeer & { connectionState: string; emit: () => void } {
  const listeners: Array<() => void> = [];
  return {
    connectionState: initial,
    iceGatheringState: "complete",
    localDescription: null,
    addTrack() {
      return undefined;
    },
    async createOffer() {
      return { type: "offer", sdp: "v=0\r\noffer" };
    },
    async setLocalDescription() {
      return undefined;
    },
    async setRemoteDescription() {
      return undefined;
    },
    addEventListener(
      type: "icegatheringstatechange" | "connectionstatechange",
      listener: () => void,
    ) {
      if (type === "connectionstatechange") {
        listeners.push(listener);
      }
    },
    removeEventListener() {
      return undefined;
    },
    close() {
      return undefined;
    },
    emit() {
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}

function fakeStream(): MediaStream {
  const tracks = [{ kind: "video" }, { kind: "audio" }] as MediaStreamTrack[];
  return { getTracks: () => tracks } as MediaStream;
}

function fakePeer(): WhipPeer & {
  tracks: unknown[];
  remote: string | null;
  closed: boolean;
} {
  const peer = {
    iceGatheringState: "new" as WhipPeer["iceGatheringState"],
    localDescription: null as { sdp: string } | null,
    tracks: [] as unknown[],
    remote: null as string | null,
    closed: false,
    listeners: [] as Array<() => void>,
    addTrack(track: unknown) {
      peer.tracks.push(track);
    },
    async createOffer() {
      return { type: "offer" as const, sdp: "v=0\r\noffer" };
    },
    async setLocalDescription() {
      peer.localDescription = { sdp: "v=0\r\ngathered" };
    },
    async setRemoteDescription(description: { sdp: string }) {
      peer.remote = description.sdp;
    },
    addEventListener(_type: "icegatheringstatechange", listener: () => void) {
      peer.listeners.push(listener);
    },
    removeEventListener(_type: "icegatheringstatechange", listener: () => void) {
      peer.listeners = peer.listeners.filter((item) => item !== listener);
    },
    close() {
      peer.closed = true;
    },
  };
  return peer;
}
