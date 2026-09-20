"use client";

import type { AuthClientConfig } from "@hasut/types";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../../lib/api";

/**
 * Captcha keys, SSO availability, and password rules are deployment settings,
 * so every sign-in surface reads them from the API instead of hardcoding them.
 */
export function useAuthConfig(): { config: AuthClientConfig | null; ready: boolean } {
  const [config, setConfig] = useState<AuthClientConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await createWebApiClient().authConfig();
        if (!cancelled) {
          setConfig(loaded);
        }
      } catch {
        // Sign-in still works without it: no captcha token, no SSO buttons.
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, ready };
}
