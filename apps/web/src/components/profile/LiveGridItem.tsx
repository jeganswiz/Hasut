import { formatClock } from "@hasut/ui";
import { Eye, Heart, Play } from "lucide-react";
import { compactCount, relativeTime } from "../../lib/profile-model";
import type { ProfileLiveCard } from "../../lib/profile-model";

export function LiveGridItem({
  item,
  memberId,
  engagement,
  nowMs,
}: {
  item: ProfileLiveCard;
  memberId: string;
  engagement: { views: number; likes: number } | "loading" | "hidden";
  nowMs: number | null;
}) {
  const when = nowMs === null ? "" : relativeTime(item.startedAt, nowMs);
  return (
    <a
      href={`/stories/${memberId}`}
      aria-label={item.title}
      className="group relative block aspect-square overflow-hidden rounded-md bg-muted sm:rounded-lg"
    >
      {item.thumbnailUrl !== null ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          <Play className="size-6" aria-hidden="true" />
        </span>
      )}
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-foreground/70 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
        <Play className="size-3" aria-hidden="true" />
        {item.durationSeconds !== null ? formatClock(item.durationSeconds) : "Recorded"}
      </span>
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
        {when.length > 0 ? <span>{when}</span> : null}
      </span>
    </a>
  );
}
