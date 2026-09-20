"use client";

import { HasutApiError } from "@hasut/api-client";
import type { AdminBusinessView } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function BusinessesTable() {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading businesses…");
  const [rows, setRows] = useState<AdminBusinessView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await createAdminApiClient().listAdminBusinesses();
      setRows(data);
      setState(data.length === 0 ? "empty" : "success");
      setMessage(data.length === 0 ? "No businesses listed." : "Owner phone numbers are omitted.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load businesses.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Businesses">
        <p>{denied}</p>
      </Surface>
    );
  }

  return (
    <Surface state={state} title="Businesses">
      <p>{message}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.status}</td>
              <td>{row.ownerDisplayName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
