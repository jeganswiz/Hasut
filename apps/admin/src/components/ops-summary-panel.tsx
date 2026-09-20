"use client";

import { HasutApiError } from "@hasut/api-client";
import type { OpsSummaryView } from "@hasut/types";
import { KpiCard, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

export function OpsSummaryPanel() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading operations counts…");
  const [summary, setSummary] = useState<OpsSummaryView | null>(null);

  const load = useCallback(async () => {
    const token = await adminTokenStorage.getAccessToken();
    if (token === null) {
      setState("empty");
      setMessage("Sign in to see pending verifications, reports, and tickets.");
      return;
    }
    try {
      const data = await createAdminApiClient().getOpsSummary();
      setSummary(data);
      setState("success");
      setMessage("Live counts from the API. Empty zeros are expected on a fresh environment.");
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        setState("empty");
        setMessage("Sign in to see pending verifications, reports, and tickets.");
        return;
      }
      setState("error");
      setMessage(
        error instanceof HasutApiError ? error.message : "Unable to load operations counts.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Surface state={state} title="Operations">
      <p>{message}</p>
      {summary !== null ? (
        <div className="admin-kpi-grid">
          <KpiCard
            label="Pending identity"
            value={summary.pendingVerifications}
            hint="Identity only — not skill verification"
            tone="primary"
          />
          <KpiCard label="Open reports" value={summary.openReports} tone="warning" />
          <KpiCard label="Open tickets" value={summary.openTickets} tone="secondary" />
          <KpiCard label="Suspended members" value={summary.suspendedMembers} tone="success" />
        </div>
      ) : null}
    </Surface>
  );
}
