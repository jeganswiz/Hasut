import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";
import { StoryPlaybackService } from "./story-playback.service";

const TICK_MS = 15_000;

/** Polls pending videos only when `FFMPEG_PATH` is set. An empty path leaves stories PENDING. */
@Injectable()
export class StoryPlaybackWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly playback: StoryPlaybackService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  onModuleInit(): void {
    if (this.config.get("FFMPEG_PATH", { infer: true }).trim().length === 0) {
      return;
    }
    this.timer = setInterval(() => {
      void this.playback.processNext().catch(() => undefined);
    }, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
