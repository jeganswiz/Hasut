"use client";

import { HasutApiError } from "@hasut/api-client";
import type { ConnectionView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PullToRefresh } from "../../../components/pull-to-refresh";
import { createWebApiClient } from "../../../lib/api";
import { isUnauthenticated, redirectToLogin } from "../../../lib/member-nav";
import { readVisit, VISIT_KEYS, writeVisit } from "../../../lib/visit-cache";

interface ConnectionsVisit {
  items: ConnectionView[];
  message: string;
  state: SurfaceState;
}

export default function ConnectionsPage() {
  const cached = readVisit<ConnectionsVisit>(VISIT_KEYS.connections);
  const [state, setState] = useState<SurfaceState>(cached?.state ?? "loading");
  const [message, setMessage] = useState(cached?.message ?? "Loading connections…");
  const [items, setItems] = useState<ConnectionView[]>(cached?.items ?? []);

  const load = useCallback(async () => {
    try {
      const data = await createWebApiClient().listConnections();
      const nextState: SurfaceState = data.length === 0 ? "empty" : "success";
      const nextMessage =
        data.length === 0 ? "No connection requests yet." : `${data.length} connections`;
      setItems(data);
      setState(nextState);
      setMessage(nextMessage);
      writeVisit(VISIT_KEYS.connections, { items: data, message: nextMessage, state: nextState });
    } catch (error) {
      if (isUnauthenticated(error)) {
        redirectToLogin("/connections");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load connections.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(item: ConnectionView, action: "accept" | "reject" | "cancel"): Promise<void> {
    const client = createWebApiClient();
    try {
      if (action === "accept") {
        await client.acceptConnection(item.id);
      } else if (action === "reject") {
        await client.rejectConnection(item.id);
      } else {
        await client.cancelConnection(item.id);
      }
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to update this request.");
    }
  }

  return (
    <PullToRefresh onRefresh={load}>
      <main>
        <h1>Connections</h1>
        <p className="lede">
          Request, accept, reject, or cancel. Chat opens after both sides accept.
        </p>
        <Surface state={state} title="Your network">
          <p>{message}</p>
          <div className="stack">
            {items.map((item) => (
              <article key={item.id}>
                <strong>{item.peer.displayName}</strong>
                <p>
                  {item.status} · {item.direction}
                </p>
                {item.status === "PENDING" && item.direction === "INCOMING" ? (
                  <p className="actions">
                    <Button onClick={() => void act(item, "accept")}>Accept</Button>
                    <Button variant="secondary" onClick={() => void act(item, "reject")}>
                      Reject
                    </Button>
                  </p>
                ) : null}
                {item.status === "PENDING" && item.direction === "OUTGOING" ? (
                  <Button variant="secondary" onClick={() => void act(item, "cancel")}>
                    Cancel
                  </Button>
                ) : null}
                {item.status === "ACCEPTED" && item.conversationId !== null ? (
                  <p>
                    <Link href={`/conversations/${item.conversationId}`}>Open chat</Link>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </Surface>
      </main>
    </PullToRefresh>
  );
}
