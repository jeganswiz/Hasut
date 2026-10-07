import type { StoryView } from "@hasut/types";
import { Button } from "@hasut/ui";
import { Camera, ChevronDown } from "lucide-react";
import { sortByCreatedAt, type PresenceSort } from "../../lib/profile-model";
import { PresenceGridItem } from "./PresenceGridItem";
import { ProfileEmptyState } from "./ProfileEmptyState";

export function PresenceGrid({
  stories,
  memberId,
  engagement,
  engagementReady,
  sort,
  onSort,
  nowMs,
}: {
  stories: StoryView[];
  memberId: string;
  engagement: Record<string, { views: number; likes: number }>;
  engagementReady: boolean;
  sort: PresenceSort;
  onSort: (sort: PresenceSort) => void;
  nowMs: number | null;
}) {
  const posted = sortByCreatedAt(
    stories.filter((story) => story.kind !== "LIVE"),
    sort,
  );
  if (posted.length === 0) {
    return (
      <ProfileEmptyState
        icon={Camera}
        title="No presence posts yet"
        body="Share your first presence with the local community."
        action={
          <Button asChild>
            <a href="/story">Add Presence</a>
          </Button>
        }
      />
    );
  }
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-sans text-sm text-muted-foreground"
          aria-label={sort === "latest" ? "Showing latest presence" : "Showing oldest presence"}
          onClick={() => onSort(sort === "latest" ? "oldest" : "latest")}
        >
          {sort === "latest" ? "Latest" : "Oldest"}
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 sm:gap-2 lg:grid-cols-4">
        {posted.map((story) => (
          <PresenceGridItem
            key={story.id}
            story={story}
            memberId={memberId}
            nowMs={nowMs}
            engagement={engagement[story.id] ?? (engagementReady ? "hidden" : "loading")}
          />
        ))}
      </div>
    </div>
  );
}
