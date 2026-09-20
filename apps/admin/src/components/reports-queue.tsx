"use client";

import { HasutApiError } from "@hasut/api-client";
import type { AdminReportView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function ReportsQueue() {
  const { ready, denied } = useAdminSession(["ADMIN", "MODERATOR"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading reports…");
  const [items, setItems] = useState<AdminReportView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const queue = await createAdminApiClient().listAdminReports();
      setItems(queue);
      setState(queue.length === 0 ? "empty" : "success");
      setMessage(
        queue.length === 0
          ? "No open reports."
          : "Hide content or dismiss. Payloads omit phone numbers.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load reports.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Reports">
        <p>{denied}</p>
      </Surface>
    );
  }

  async function act(id: string, action: "HIDE" | "DISMISS"): Promise<void> {
    setState("loading");
    try {
      await createAdminApiClient().moderateReport(id, action);
      await load();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof HasutApiError ? error.message : "Unable to moderate this report.",
      );
    }
  }

  return (
    <Surface state={state} title="Reports">
      <p>{message}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Target</th>
            <th>Reason</th>
            <th>Reporter</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.targetType} · {item.targetId.slice(0, 8)}
              </td>
              <td>{item.reasonCode}</td>
              <td>{item.reporter.displayName}</td>
              <td>
                <div className="actions">
                  <Button onClick={() => void act(item.id, "HIDE")}>Hide content</Button>
                  <Button variant="secondary" onClick={() => void act(item.id, "DISMISS")}>
                    Dismiss
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
