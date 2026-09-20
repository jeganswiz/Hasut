"use client";

import { HasutApiError } from "@hasut/api-client";
import type { MemberRole } from "@hasut/types";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

export function useAdminSession(allowed: MemberRole[]) {
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const allowedKey = allowed.join(",");

  const ensure = useCallback(async () => {
    const token = await adminTokenStorage.getAccessToken();
    if (token === null) {
      window.location.assign("/login");
      return false;
    }
    try {
      const me = await createAdminApiClient().me();
      const roles = allowedKey.split(",") as MemberRole[];
      const allowedNow =
        me.roles.includes("ADMIN") || roles.some((role) => me.roles.includes(role));
      if (!allowedNow) {
        setDenied("This account cannot open this queue.");
        return false;
      }
      setReady(true);
      return true;
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return false;
      }
      setDenied(error instanceof HasutApiError ? error.message : "Unable to verify your session.");
      return false;
    }
  }, [allowedKey]);

  useEffect(() => {
    void ensure();
  }, [ensure]);

  return { ready, denied };
}
