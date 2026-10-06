"use client";

import { useEffect, useState } from "react";
import { readWatchedStoryIds } from "./story-ring";

/** Story ids this browser has opened. A refresh or a return to the map reads the same list. */
export function useWatchedStoryIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const read = (): void => setIds(readWatchedStoryIds(window.localStorage));
    read();
    window.addEventListener("focus", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("focus", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return ids;
}
