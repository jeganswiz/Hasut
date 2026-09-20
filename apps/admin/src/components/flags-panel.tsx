"use client";

import { HasutApiError } from "@hasut/api-client";
import type { FeatureFlagAdminView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function FlagsPanel() {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading flags…");
  const [rows, setRows] = useState<FeatureFlagAdminView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await createAdminApiClient().listAdminFlags();
      setRows(data);
      setState(data.length === 0 ? "empty" : "success");
      setMessage(data.length === 0 ? "No flags seeded." : "Toggle remote flags without a deploy.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load flags.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Flags">
        <p>{denied}</p>
      </Surface>
    );
  }

  return (
    <Surface state={state} title="Feature flags">
      <p>{message}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Description</th>
            <th>Enabled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.key}</td>
              <td>{row.description}</td>
              <td>{row.enabled ? "On" : "Off"}</td>
              <td>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void createAdminApiClient()
                      .updateAdminFlag(row.key, !row.enabled)
                      .then(() => load())
                  }
                >
                  {row.enabled ? "Disable" : "Enable"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
