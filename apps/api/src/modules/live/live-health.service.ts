import type { LiveHealthState, LiveHealthView } from "@hasut/types";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";
import { LiveViewerRegistry } from "../realtime/live-viewer-registry";

interface PathReady {
  ready: boolean;
  tracks: string[];
  bytesReceived: number;
}

/**
 * Asks MediaMTX whether a path is actually publishing. When the Control API
 * is not configured, health falls back to the host heartbeat.
 */
@Injectable()
export class LiveHealthService {
  constructor(
    private readonly config: ConfigService<ApiEnv, true>,
    private readonly viewers: LiveViewerRegistry,
  ) {}

  async probe(input: {
    liveId: string;
    lastHeartbeatAt: Date | null;
    idleTimeoutSeconds: number;
  }): Promise<LiveHealthView> {
    const checkedAt = new Date();
    const lastHeartbeatAt = input.lastHeartbeatAt?.toISOString() ?? null;
    const viewerCount = this.viewers.count(input.liveId);
    const origin = this.config
      .get("LIVE_CONTROL_API_URL", { infer: true })
      .trim()
      .replace(/\/$/, "");
    if (origin.length === 0) {
      return this.fromHeartbeat(input, checkedAt, viewerCount, lastHeartbeatAt);
    }
    try {
      const path = await this.readPath(origin, input.liveId);
      if (path === null) {
        return this.view("WAITING", false, [], null, viewerCount, lastHeartbeatAt, checkedAt);
      }
      const bitrateKbps = path.bytesReceived > 0 ? Math.round(path.bytesReceived / 125) : null;
      if (!path.ready) {
        return this.view(
          "WAITING",
          false,
          path.tracks,
          bitrateKbps,
          viewerCount,
          lastHeartbeatAt,
          checkedAt,
        );
      }
      const state: LiveHealthState = path.tracks.length === 0 ? "DEGRADED" : "HEALTHY";
      return this.view(
        state,
        true,
        path.tracks,
        bitrateKbps,
        viewerCount,
        lastHeartbeatAt,
        checkedAt,
      );
    } catch {
      return this.view("OFFLINE", false, [], null, viewerCount, lastHeartbeatAt, checkedAt);
    }
  }

  private fromHeartbeat(
    input: { lastHeartbeatAt: Date | null; idleTimeoutSeconds: number },
    checkedAt: Date,
    viewerCount: number,
    lastHeartbeatAt: string | null,
  ): LiveHealthView {
    if (input.lastHeartbeatAt === null) {
      return this.view("UNKNOWN", false, [], null, viewerCount, lastHeartbeatAt, checkedAt);
    }
    const ageMs = checkedAt.getTime() - input.lastHeartbeatAt.getTime();
    if (ageMs > input.idleTimeoutSeconds * 1000) {
      return this.view("OFFLINE", false, [], null, viewerCount, lastHeartbeatAt, checkedAt);
    }
    return this.view("UNKNOWN", false, [], null, viewerCount, lastHeartbeatAt, checkedAt);
  }

  private async readPath(origin: string, liveId: string): Promise<PathReady | null> {
    const encoded = encodeURIComponent(`live/${liveId}`);
    const response = await fetch(`${origin}/v3/paths/get/${encoded}`, { method: "GET" });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("control-api");
    }
    const body: unknown = await response.json();
    return readPathReady(body);
  }

  private view(
    state: LiveHealthState,
    streamReady: boolean,
    tracks: string[],
    bitrateKbps: number | null,
    viewerCount: number,
    lastHeartbeatAt: string | null,
    checkedAt: Date,
  ): LiveHealthView {
    return {
      state,
      streamReady,
      tracks,
      bitrateKbps,
      viewerCount,
      lastHeartbeatAt,
      checkedAt: checkedAt.toISOString(),
    };
  }
}

export function readPathReady(body: unknown): PathReady {
  if (typeof body !== "object" || body === null) {
    return { ready: false, tracks: [], bytesReceived: 0 };
  }
  const record = body as Record<string, unknown>;
  const tracks = Array.isArray(record.tracks)
    ? record.tracks.filter((item): item is string => typeof item === "string")
    : [];
  return {
    ready: record.ready === true,
    tracks,
    bytesReceived: typeof record.bytesReceived === "number" ? record.bytesReceived : 0,
  };
}
