"use client";

import { useParams } from "next/navigation";
import { LivePlayer } from "../../../../components/live/live-player";

export default function LiveWatchPage() {
  const params = useParams<{ id: string }>();
  return (
    <main className="presence-page">
      <LivePlayer liveId={params.id} />
    </main>
  );
}
