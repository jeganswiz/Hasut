"use client";

import { Button, cssVar } from "@hasut/ui";
import { useEffect, useState } from "react";
import {
  pwaInstallKind,
  readPwaDismissed,
  readStandaloneDisplay,
  writePwaDismissed,
  type PwaInstallKind,
} from "../lib/pwa-install";

interface DeferredInstallPrompt {
  prompt: () => Promise<void>;
}

export function PwaInstall() {
  const [kind, setKind] = useState<PwaInstallKind>("hidden");
  const [prompt, setPrompt] = useState<DeferredInstallPrompt | null>(null);

  useEffect(() => {
    const standalone = readStandaloneDisplay({
      matchMedia: (query) => window.matchMedia(query),
      navigatorStandalone: (window.navigator as Navigator & { standalone?: boolean }).standalone,
    });

    function refresh(canPrompt: boolean): void {
      setKind(
        pwaInstallKind({
          standalone,
          dismissed: readPwaDismissed(window.sessionStorage),
          canPrompt,
          userAgent: window.navigator.userAgent,
        }),
      );
    }

    refresh(false);

    function onPrompt(event: Event): void {
      event.preventDefault();
      const next = event as Event & DeferredInstallPrompt;
      setPrompt(next);
      refresh(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (kind === "hidden") {
    return null;
  }

  async function install(): Promise<void> {
    if (prompt === null) {
      return;
    }
    try {
      await prompt.prompt();
    } catch {
      // Browser cancelled; keep the page usable.
    }
    setPrompt(null);
    setKind("hidden");
  }

  function dismiss(): void {
    writePwaDismissed(window.sessionStorage);
    setKind("hidden");
  }

  return (
    <aside className="pwa-install" aria-label="Install HASUT">
      <p style={{ margin: 0, color: cssVar("text") }}>
        {kind === "ios-hint"
          ? "Add HASUT to your Home Screen from the Share menu."
          : "Install HASUT on this device for the map and presence."}
      </p>
      <div className="pwa-install-actions">
        {kind === "prompt" ? <Button onClick={() => void install()}>Install</Button> : null}
        <Button variant="secondary" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </aside>
  );
}
