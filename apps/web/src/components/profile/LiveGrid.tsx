import { Button } from "@hasut/ui";
import { Radio } from "lucide-react";
import type { LiveSessionView, StoryView } from "@hasut/types";
import { recordedLiveCards } from "../../lib/profile-model";
import { LiveGridItem } from "./LiveGridItem";
import { ProfileEmptyState } from "./ProfileEmptyState";

export function LiveGrid({
  stories,
  live,
  memberId,
  engagement,
  engagementReady,
  nowMs,
}: {
  stories: StoryView[];
  live: LiveSessionView | null;
  memberId: string;
  engagement: Record<string, { views: number; likes: number }>;
  engagementReady: boolean;
  nowMs: number | null;
}) {
  const isLive = live?.status === "LIVE";
  const items = recordedLiveCards(stories, live);
  if (items.length === 0) {
    return (
      <ProfileEmptyState
        icon={Radio}
        title="No recorded lives yet"
        body={
          isLive
            ? "You are live now. A recording will appear here after you end it."
            : "When you go live, your recordings will appear here."
        }
        action={
          isLive ? (
            <Button asChild variant="secondary">
              <a href={`/stories/${memberId}`}>Open live</a>
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2 lg:grid-cols-4">
      {items.map((item) => (
        <LiveGridItem
          key={item.id}
          item={item}
          memberId={memberId}
          nowMs={nowMs}
          engagement={engagement[item.id] ?? (engagementReady ? "hidden" : "loading")}
        />
      ))}
    </div>
  );
}
