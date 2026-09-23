export interface StoryTranscodeRecipe {
  videoPath: string;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  originalAudioMode: "KEEP" | "MUTE" | "OVERLAY";
  /** Ignored when the member kept the camera audio. */
  addedAudioPath: string | null;
  audioStartSeconds: number;
  audioEndSeconds: number | null;
  /** Must be the `index.m3u8` file inside the output directory. */
  playlistPath: string;
}

/**
 * ffmpeg argument list for a 240p VOD playlist. Caption text is never an argument.
 * The binary itself is not included; the caller decides whether ffmpeg exists.
 */
export function buildStoryTranscodePlan(recipe: StoryTranscodeRecipe): string[] {
  if (
    !recipe.playlistPath.endsWith("/index.m3u8") &&
    !recipe.playlistPath.endsWith("\\index.m3u8")
  ) {
    throw new Error("Playlist path must be index.m3u8");
  }
  const useAdded = recipe.addedAudioPath !== null && recipe.originalAudioMode !== "KEEP";
  const segmentPattern = recipe.playlistPath.replace(/index\.m3u8$/, "seg_%03d.ts");
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  args.push(...timedInput(recipe.videoPath, recipe.trimStartSeconds, recipe.trimEndSeconds));
  if (useAdded && recipe.addedAudioPath !== null) {
    args.push(
      ...timedInput(recipe.addedAudioPath, recipe.audioStartSeconds, recipe.audioEndSeconds),
    );
  }
  args.push(...videoEncode(recipe.originalAudioMode, useAdded));
  args.push(
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    segmentPattern,
    recipe.playlistPath,
  );
  return args;
}

function timedInput(filePath: string, startSeconds: number, endSeconds: number | null): string[] {
  const args = ["-ss", String(startSeconds)];
  if (endSeconds !== null) {
    args.push("-t", String(endSeconds - startSeconds));
  }
  args.push("-i", filePath);
  return args;
}

function videoEncode(mode: StoryTranscodeRecipe["originalAudioMode"], useAdded: boolean): string[] {
  const video = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p"];
  if (mode === "OVERLAY" && useAdded) {
    return [
      "-filter_complex",
      "[0:v:0]scale=-2:240[v];[0:a:0][1:a:0]amix=inputs=2:duration=shortest:dropout_transition=0[aout]",
      "-map",
      "[v]",
      "-map",
      "[aout]",
      ...video,
      "-c:a",
      "aac",
      "-b:a",
      "96k",
    ];
  }
  const scaled = ["-vf", "scale=-2:240", ...video];
  if (mode === "MUTE" && useAdded) {
    return [...scaled, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "96k", "-shortest"];
  }
  if (mode === "MUTE") {
    return [...scaled, "-map", "0:v:0", "-an"];
  }
  return [...scaled, "-map", "0:v:0", "-map", "0:a:0?", "-c:a", "aac", "-b:a", "96k"];
}
