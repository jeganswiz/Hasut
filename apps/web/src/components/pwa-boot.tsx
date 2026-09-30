"use client";

import { useEffect } from "react";
import { PwaInstall } from "./pwa-install";

export function PwaBoot() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return <PwaInstall />;
}
