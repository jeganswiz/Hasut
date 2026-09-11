"use client";

import { HasutApiError } from "@hasut/api-client";
import type { ConnectionView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { createWebApiClient } from "../../lib/api";
import "../social.css";

export default function ConnectionsPage() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading connections…");
  const [items, setItems] = useState<ConnectionView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await createWebApiClient().listConnections();
      setItems(data);
      setState(data.length === 0 ? "empty" : "success");
      setMessage(data.length === 0 ? "No connection requests yet." : `${data.length} connections`);
    } catch (error) {
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
    <main>
      <AppNav />
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
                  <a href={`/conversations/${item.conversationId}`}>Open chat</a>
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </Surface>
    </main>
  );
}
