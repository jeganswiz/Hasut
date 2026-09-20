"use client";

import { themeToCssText } from "@hasut/config";
import { useEffect } from "react";
import { createWebApiClient } from "../lib/api";

export function ThemeBoot() {
  useEffect(() => {
    void createWebApiClient()
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
