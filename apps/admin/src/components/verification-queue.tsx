"use client";

import { HasutApiError } from "@hasut/api-client";
import type { AdminVerificationRequest } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function VerificationQueue() {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading identity verification queue…");
  const [items, setItems] = useState<AdminVerificationRequest[]>([]);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const queue = await createAdminApiClient().listAdminVerification();
      setItems(queue);
      setState(queue.length === 0 ? "empty" : "success");
      setMessage(
        queue.length === 0
          ? "No pending identity verification requests."
          : "Approve identity only. This is not skill verification.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load the queue.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Verification">
        <p>{denied}</p>
      </Surface>
    );
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT"): Promise<void> {
    setState("loading");
    try {
      await createAdminApiClient().decideVerification(id, { decision, reviewNote: note });
      setNote("");
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to save the decision.");
    }
  }

  return (
    <Surface state={state} title="Identity verification">
      <p>{message}</p>
      <label>
        Review note
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Status</th>
            <th>Documents</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.member.displayName}</td>
              <td>{item.status}</td>
              <td>{item.documentMediaIds.length}</td>
              <td>
                <div className="actions">
                  <Button onClick={() => void decide(item.id, "APPROVE")}>Approve identity</Button>
                  <Button variant="secondary" onClick={() => void decide(item.id, "REJECT")}>
                    Reject
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
