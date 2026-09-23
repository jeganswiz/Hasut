import { spawn } from "node:child_process";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";

/** Runs an argument list. The binary comes from `FFMPEG_PATH`, never from member input. */
export interface StoryTranscoder {
  transcode(args: readonly string[]): Promise<void>;
}

export const STORY_TRANSCODER = Symbol("STORY_TRANSCODER");

@Injectable()
export class FfmpegStoryTranscoder implements StoryTranscoder {
  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  async transcode(args: readonly string[]): Promise<void> {
    const binary = this.config.get("FFMPEG_PATH", { infer: true }).trim();
    if (binary.length === 0) {
      throw new Error("ffmpeg is not configured");
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn(binary, args, { shell: false, windowsHide: true });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`ffmpeg exited ${code ?? "null"}`));
      });
    });
  }
}
