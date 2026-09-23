import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { buildStoryTranscodePlan } from "./story-transcode";
import { STORY_TRANSCODER, type StoryTranscoder } from "./story-transcoder";

const STORY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoryPlaybackOutcome = "idle" | "ready" | "waiting" | "failed";

interface PendingStory {
  id: string;
  videoMediaId: string | null;
  audioMediaId: string | null;
  audioSource: string;
  audioTrackId: string | null;
  audioStartSeconds: number;
  audioEndSeconds: number | null;
  originalAudioMode: string;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
}

@Injectable()
export class StoryPlaybackService {
  private readonly logger = new Logger(StoryPlaybackService.name);
  /** Stories that cannot succeed in this process. A restart may try them again. */
  private readonly skipped = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<ApiEnv, true>,
    @Inject(STORY_TRANSCODER) private readonly transcoder: StoryTranscoder,
  ) {}

  /**
   * Turns one pending video into a 240p playlist. Does nothing unless ffmpeg is
   * configured and stored objects have a public http(s) URL. Members cannot call this.
   */
  async processNext(): Promise<StoryPlaybackOutcome> {
    if (this.config.get("FFMPEG_PATH", { infer: true }).trim().length === 0) {
      return "idle";
    }
    if (!isPublicHttpUrl(this.media.objectUrl("story-hls/ready-check/index.m3u8"))) {
      return "idle";
    }
    const story = await this.prisma.story.findFirst({
      where: {
        kind: "VIDEO",
        playbackStatus: "PENDING",
        moderationStatus: "ACTIVE",
        expiresAt: { gt: new Date() },
        ...(this.skipped.size > 0 ? { id: { notIn: [...this.skipped] } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    if (story === null) {
      return "idle";
    }
    if (!STORY_ID.test(story.id)) {
      this.skipped.add(story.id);
      return "failed";
    }
    try {
      return await this.publish(story);
    } catch (error) {
      this.skipped.add(story.id);
      const name = error instanceof Error ? error.name : "error";
      this.logger.warn(`Story playback failed for ${story.id} (${name})`);
      return "failed";
    }
  }

  private async publish(story: PendingStory): Promise<StoryPlaybackOutcome> {
    const mode = audioMode(story.originalAudioMode);
    if (mode === null || story.videoMediaId === null) {
      this.skipped.add(story.id);
      return "failed";
    }
    const video = await this.readReady(story.videoMediaId);
    if (video === null) {
      return "waiting";
    }
    const wantsAdded = mode !== "KEEP" && story.audioSource !== "NONE";
    const audio = wantsAdded ? await this.readAddedAudio(story) : null;
    if (wantsAdded && audio === null) {
      return "waiting";
    }

    const directory = await mkdtemp(join(tmpdir(), "hasut-story-"));
    try {
      const videoPath = join(directory, "video.bin");
      const playlistPath = join(directory, "index.m3u8");
      await writeFile(videoPath, video);
      let addedAudioPath: string | null = null;
      if (audio !== null) {
        addedAudioPath = join(directory, "audio.bin");
        await writeFile(addedAudioPath, audio);
      }
      const args = buildStoryTranscodePlan({
        videoPath,
        trimStartSeconds: story.trimStartSeconds,
        trimEndSeconds: story.trimEndSeconds,
        originalAudioMode: mode,
        addedAudioPath,
        audioStartSeconds: story.audioStartSeconds,
        audioEndSeconds: story.audioEndSeconds,
        playlistPath,
      });
      await this.transcoder.transcode(args);
      const playlistUrl = await this.storePlaylist(story.id, directory);
      const updated = await this.prisma.story.updateMany({
        where: { id: story.id, playbackStatus: "PENDING", moderationStatus: "ACTIVE" },
        data: {
          playbackStatus: "READY",
          hlsUrl: playlistUrl,
          previewHlsUrl: playlistUrl,
        },
      });
      if (updated.count !== 1) {
        return "waiting";
      }
      await this.audit.record({
        action: "STORY_PLAYBACK_READY",
        entity: "story",
        entityId: story.id,
        requestId: `story-playback-${story.id}`,
        afterJson: { playbackStatus: "READY" },
      });
      return "ready";
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async readAddedAudio(story: PendingStory): Promise<Buffer | null> {
    if (story.audioSource === "UPLOAD") {
      if (story.audioMediaId === null) {
        throw new Error("Added audio is missing");
      }
      return this.readReady(story.audioMediaId);
    }
    if (story.audioSource !== "LIBRARY" || story.audioTrackId === null) {
      throw new Error("Added audio is missing");
    }
    const track = await this.prisma.audioTrack.findUnique({ where: { id: story.audioTrackId } });
    if (track === null) {
      throw new Error("Added audio is missing");
    }
    return this.readReady(track.mediaId);
  }

  private async readReady(mediaId: string): Promise<Buffer | null> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (asset === null || asset.status !== "READY") {
      return null;
    }
    return this.media.readObject(asset.objectKey);
  }

  private async storePlaylist(storyId: string, directory: string): Promise<string> {
    const names = await readdir(directory);
    const playlistName = "index.m3u8";
    if (!names.includes(playlistName)) {
      throw new Error("Playlist was not written");
    }
    const prefix = `story-hls/${storyId}`;
    for (const name of names) {
      if (!name.endsWith(".m3u8") && !name.endsWith(".ts")) {
        continue;
      }
      const body = await readFile(join(directory, name));
      const contentType = name.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
      await this.media.writeObject(`${prefix}/${name}`, body, contentType);
    }
    const playlistKey = `${prefix}/${playlistName}`;
    const head = await this.media.headObject(playlistKey);
    if (head === null) {
      throw new Error("Playlist was not stored");
    }
    const playlistUrl = this.media.objectUrl(playlistKey);
    if (!isPublicHttpUrl(playlistUrl)) {
      throw new Error("Playlist URL is not public");
    }
    return playlistUrl;
  }
}

function audioMode(value: string): "KEEP" | "MUTE" | "OVERLAY" | null {
  if (value === "KEEP" || value === "MUTE" || value === "OVERLAY") {
    return value;
  }
  return null;
}

function isPublicHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}
