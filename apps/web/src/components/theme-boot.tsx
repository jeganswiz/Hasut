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
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor !== null) {
          themeColor.setAttribute("content", theme.tokens.primary);
        }
      })
      .catch(() => {
        /* keep boot tokens */
      });
  }, []);
  return null;
}
