"use client";

import type { StoryView } from "@hasut/types";

export function ProfileStories({ stories, memberId }: { stories: StoryView[]; memberId: string }) {
  if (stories.length === 0) {
    return null;
  }
  return (
    <div className="story-ring-row" aria-label="Active stories">
      {stories.map((story) => (
        <a
          key={story.id}
          className="story-ring"
          href={`/stories/${memberId}`}
          aria-label={story.caption.trim().length > 0 ? story.caption : "Watch presence"}
        >
          {story.imageUrl !== null ? <img src={story.imageUrl} alt="" /> : <span>Story</span>}
        </a>
      ))}
    </div>
  );
}
