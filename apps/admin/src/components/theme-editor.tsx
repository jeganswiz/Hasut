"use client";

import { HasutApiError } from "@hasut/api-client";
import { THEME_TOKEN_KEYS, type ThemeEditorView, type ThemeTokens } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function ThemeEditor() {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading theme draft…");
  const [editor, setEditor] = useState<ThemeEditorView | null>(null);
  const [tokens, setTokens] = useState<ThemeTokens | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await createAdminApiClient().getThemeEditor();
      setEditor(data);
      setTokens(data.tokens);
      setState("success");
      setMessage(
        data.contrastWarnings.length > 0
          ? data.contrastWarnings.join(" ")
          : `Version ${data.version} (${data.status}).`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load the theme.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Theme">
        <p>{denied}</p>
      </Surface>
    );
  }

  return (
    <Surface state={state} title="Theme editor">
      <p>{message}</p>
      {tokens !== null ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void createAdminApiClient()
              .saveThemeDraft(tokens)
              .then((data) => {
                setEditor(data);
                setTokens(data.tokens);
                setMessage("Draft saved. Publish to cache-bust clients.");
              })
              .catch((error: unknown) => {
                setState("error");
                setMessage(
                  error instanceof HasutApiError ? error.message : "Unable to save draft.",
                );
              });
          }}
        >
          {THEME_TOKEN_KEYS.map((key) => (
            <label key={key}>
              {key}
              <input
                value={tokens[key]}
                onChange={(event) => setTokens({ ...tokens, [key]: event.target.value })}
              />
            </label>
          ))}
          <div className="actions">
            <Button type="submit">Save draft</Button>
            <Button
              variant="secondary"
              onClick={() =>
                void createAdminApiClient()
                  .publishTheme()
                  .then((data) => {
                    setEditor(data);
                    setTokens(data.tokens);
                    setMessage("Theme published. THEME_PUBLISH was audited.");
                  })
              }
            >
              Publish
            </Button>
          </div>
        </form>
      ) : null}
      {editor?.contrastWarnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </Surface>
  );
}
