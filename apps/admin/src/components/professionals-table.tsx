"use client";

import { HasutApiError } from "@hasut/api-client";
import type { AdminProfessionalView } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function ProfessionalsTable() {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading professionals…");
  const [rows, setRows] = useState<AdminProfessionalView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await createAdminApiClient().listAdminProfessionals();
      setRows(data);
      setState(data.length === 0 ? "empty" : "success");
      setMessage(
        data.length === 0
          ? "No professional profiles yet."
          : "Identity status is shown separately from skill verification.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load professionals.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Professionals">
        <p>{denied}</p>
      </Surface>
    );
  }

  return (
    <Surface state={state} title="Professionals">
      <p>{message}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Headline</th>
            <th>Status</th>
            <th>Identity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.displayName}</td>
              <td>{row.headline}</td>
              <td>{row.status}</td>
              <td>{row.identityVerificationStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
