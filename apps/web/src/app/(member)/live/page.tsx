"use client";

import type { LiveCardView, LiveDiscoverResult } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PullToRefresh } from "../../../components/pull-to-refresh";
import { createWebApiClient } from "../../../lib/api";
import { readVisit, VISIT_KEYS, writeVisit } from "../../../lib/visit-cache";

export default function LiveDiscoverPage() {
  const cached = readVisit<LiveDiscoverResult>(VISIT_KEYS.live);
  const [state, setState] = useState<SurfaceState>(cached ? "success" : "loading");
  const [result, setResult] = useState<LiveDiscoverResult | null>(cached ?? null);

  const load = useCallback(async () => {
    try {
      const data = await createWebApiClient().discoverLive();
      setResult(data);
      setState("success");
      writeVisit(VISIT_KEYS.live, data);
    } catch {
      setResult((current) => {
        if (current === null) {
          setState("error");
        }
        return current;
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PullToRefresh onRefresh={load}>
      <main className="presence-page">
        <h1>Live</h1>
        {state !== "success" || result === null ? (
          <Surface state={state} title="Live">
            <p>
              {state === "error" ? "Live discovery is not available." : "Finding lives nearby…"}
            </p>
          </Surface>
        ) : (
          <>
            <LiveSection title="Live now" cards={result.liveNow} />
            <LiveSection title="My Patrons" cards={result.patrons} />
            <LiveSection title="Upcoming" cards={result.upcoming} />
            <LiveSection title="Recommended" cards={result.recommended} />
            <LiveSection title="Recently recorded" cards={result.recentReplays} />
          </>
        )}
      </main>
    </PullToRefresh>
  );
}

function LiveSection({ title, cards }: { title: string; cards: LiveCardView[] }) {
  return (
    <section className="lv-section">
      <h2>{title}</h2>
      {cards.length === 0 ? (
        <p className="hint">Nothing here yet.</p>
      ) : (
        <ul className="lv-cards">
          {cards.map((card) => (
            <li key={`${card.status}-${card.id}`}>
              <Link href={card.href} className="lv-card">
                <strong>{card.title || "Live"}</strong>
                <span>
                  {card.host.displayName}
                  {card.category === null ? "" : ` · ${card.category}`}
                </span>
                <em>
                  {card.status === "LIVE"
                    ? `${card.viewerCount} watching`
                    : card.status === "UPCOMING"
                      ? "Upcoming"
                      : "Replay"}
                </em>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
