"use client";

import { apiErrorMessage } from "@hasut/api-client";
import type { HealthData } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createWebApiClient } from "../lib/api";

function statusMessage(health: HealthData): string {
  return `${health.service} ${health.version} is ${health.status}.`;
}

const RETRY_MS = 2_000;
const MAX_ATTEMPTS = 8;

export function HealthPanel({ initialHealth = null }: { initialHealth?: HealthData | null }) {
  const [state, setState] = useState<SurfaceState>(initialHealth ? "success" : "loading");
  const [health, setHealth] = useState<HealthData | null>(initialHealth);
  const [message, setMessage] = useState(
    initialHealth ? statusMessage(initialHealth) : "Checking API…",
  );

  const load = useCallback(async (reportError: boolean): Promise<boolean> => {
    setState("loading");
    setMessage("Checking API…");
    try {
      const data = await createWebApiClient().health("ready");
      setHealth(data);
      setState("success");
      setMessage(statusMessage(data));
      return true;
    } catch (error) {
      if (!reportError) {
        setMessage("Waiting for the HASUT API…");
        return false;
      }
      setHealth(null);
      setState("error");
      setMessage(
        apiErrorMessage(error, "Unable to reach the HASUT API. Start apps/api and try again."),
      );
      return false;
    }
  }, []);

  useEffect(() => {
    if (initialHealth) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async (attempt: number): Promise<void> => {
      const ok = await load(attempt >= MAX_ATTEMPTS);
      if (cancelled || ok || attempt >= MAX_ATTEMPTS) {
        return;
      }
      setState("loading");
      setMessage("Waiting for the HASUT API…");
      timer = setTimeout(() => {
        void tick(attempt + 1);
      }, RETRY_MS);
    };
    void tick(1);
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [initialHealth, load]);

  return (
    <Surface state={state} title="API status">
      <p>{message}</p>
      {health?.checks ? (
        <p>
          postgres {health.checks.postgres} · postgis {health.checks.postgis} · redis{" "}
          {health.checks.redis}
        </p>
      ) : null}
      {state === "error" ? (
        <p style={{ marginTop: 12 }}>
          <Button type="button" onClick={() => void load(true)}>
            Retry
          </Button>
        </p>
      ) : null}
    </Surface>
  );
}
