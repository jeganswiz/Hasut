"use client";

import { HasutApiError } from "@hasut/api-client";
import type { NotificationTemplateView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function TemplatesPanel() {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading templates…");
  const [rows, setRows] = useState<NotificationTemplateView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await createAdminApiClient().listNotificationTemplates();
      setRows(data);
      setState(data.length === 0 ? "empty" : "success");
      setMessage(
        data.length === 0 ? "No templates seeded." : "Copy is configuration-driven, not hardcoded.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load templates.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Templates">
        <p>{denied}</p>
      </Surface>
    );
  }

  return (
    <Surface state={state} title="Notification templates">
      <p>{message}</p>
      <div className="stack">
        {rows.map((row) => (
          <form
            key={row.id}
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void createAdminApiClient()
                .updateNotificationTemplate(row.id, {
                  titleTemplate: String(data.get("title") ?? ""),
                  bodyTemplate: String(data.get("body") ?? ""),
                  isActive: data.get("active") === "on",
                })
                .then(() => {
                  setMessage("Template saved.");
                  return load();
                });
            }}
          >
            <strong>{row.key}</strong>
            <label>
              Title
              <input name="title" defaultValue={row.titleTemplate} />
            </label>
            <label>
              Body
              <textarea name="body" defaultValue={row.bodyTemplate} />
            </label>
            <label>
              <input type="checkbox" name="active" defaultChecked={row.isActive} /> Active
            </label>
            <Button type="submit">Save</Button>
          </form>
        ))}
      </div>
    </Surface>
  );
}
