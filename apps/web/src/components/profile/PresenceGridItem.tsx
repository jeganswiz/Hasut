import type { StoryView } from "@hasut/types";
import { formatClock } from "@hasut/ui";
import { Eye, Heart, Play } from "lucide-react";
import { compactCount, relativeTime, trimmedDurationSeconds } from "../../lib/profile-model";

export function PresenceGridItem({
  story,
  memberId,
  engagement,
  nowMs,
}: {
  story: StoryView;
  memberId: string;
  engagement: { views: number; likes: number } | "loading" | "hidden";
  nowMs: number | null;
}) {
  const video = story.kind === "VIDEO";
  const duration = video
    ? trimmedDurationSeconds(story.trimStartSeconds, story.trimEndSeconds)
    : null;
  const label = story.caption.trim().length > 0 ? story.caption : "Watch presence";
  const when = nowMs === null ? "" : relativeTime(story.createdAt, nowMs);
  return (
    <a
      href={`/stories/${memberId}`}
      aria-label={label}
      className="group relative block aspect-square overflow-hidden rounded-md bg-muted sm:rounded-lg"
    >
      {story.imageUrl !== null ? (
        <img
          src={story.imageUrl}
          alt=""
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          {video ? <Play className="size-6" aria-hidden="true" /> : null}
        </span>
      )}
      {video && story.imageUrl !== null ? (
        <Play
          className="absolute left-2 top-2 size-4 text-primary-foreground drop-shadow"
          aria-hidden="true"
        />
      ) : null}
      {duration !== null ? (
        <span className="absolute right-2 top-2 text-xs font-medium text-primary-foreground drop-shadow">
          {formatClock(duration)}
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-foreground/75 to-transparent px-2 pb-2 pt-6 text-xs text-primary-foreground">
        <span className="flex items-center gap-2">
          {engagement === "loading" ? <span className="opacity-70">…</span> : null}
          {typeof engagement === "object" ? (
            <>
              <span className="inline-flex items-center gap-1">
                <Eye className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Views </span>
                {compactCount(engagement.views)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Likes </span>
                {compactCount(engagement.likes)}
              </span>
            </>
          ) : null}
        </span>
        {when.length > 0 ? <span className="opacity-90">{when}</span> : null}
      </span>
    </a>
  );
}
