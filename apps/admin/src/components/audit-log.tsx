"use client";

import { HasutApiError } from "@hasut/api-client";
import type { AuditLogView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function AuditLog() {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading audit log…");
  const [rows, setRows] = useState<AuditLogView[]>([]);
  const [entity, setEntity] = useState("");
  const [requestId, setRequestId] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await createAdminApiClient().listAudit({
        entity: entity.length > 0 ? entity : undefined,
        requestId: requestId.length > 0 ? requestId : undefined,
      });
      setRows(data);
      setState(data.length === 0 ? "empty" : "success");
      setMessage(
        data.length === 0
          ? "No audit rows for this filter."
          : "Phone numbers and exact coordinates are not stored in this viewer.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load audit.");
    }
  }, [entity, requestId]);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Audit">
        <p>{denied}</p>
      </Surface>
    );
  }

  return (
    <Surface state={state} title="Audit log">
      <p>{message}</p>
      <form
        className="actions"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <input
          value={entity}
          onChange={(event) => setEntity(event.target.value)}
          placeholder="entity"
          aria-label="Entity"
        />
        <input
          value={requestId}
          onChange={(event) => setRequestId(event.target.value)}
          placeholder="request id"
          aria-label="Request id"
        />
        <Button type="submit">Filter</Button>
      </form>
      <table className="admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Request</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.createdAt.replace("T", " ").slice(0, 19)}</td>
              <td>{row.action}</td>
              <td>
                {row.entity}:{row.entityId.slice(0, 8)}
              </td>
              <td>{row.requestId.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
