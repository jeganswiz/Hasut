"use client";

import { themeToCssText } from "@hasut/config";
import { useEffect } from "react";
import { createAdminApiClient } from "../lib/api";

export function ThemeBoot() {
  useEffect(() => {
    void createAdminApiClient()
      .theme()
      .then((theme) => {
        const node = document.getElementById("hasut-theme");
        if (node !== null) {
          node.textContent = themeToCssText(theme.tokens);
        }
      })
      .catch(() => {
        /* keep boot tokens */
      });
  }, []);
  return null;
}
