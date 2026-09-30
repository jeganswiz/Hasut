"use client";

import { HasutApiError } from "@hasut/api-client";
import type {
  StorageBackendName,
  StorageMigrationView,
  StorageOverview,
  StorageProviderOption,
  StorageSwitchResult,
} from "@hasut/types";
import { Button, Surface, cssVar, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

interface Draft {
  provider: StorageBackendName;
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  localRoot: string;
}

const INITIAL_DRAFT: Draft = {
  provider: "local",
  endpoint: "",
  region: "",
  bucket: "",
  accessKey: "",
  secretKey: "",
  forcePathStyle: false,
  publicBaseUrl: "",
  localRoot: "",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function applyProvider(draft: Draft, option: StorageProviderOption): Draft {
  return {
    ...draft,
    provider: option.id,
    region: option.defaultRegion,
    forcePathStyle: option.defaultForcePathStyle,
    endpoint: "",
    accessKey: "",
    secretKey: "",
    bucket: option.id === "local" ? "" : draft.bucket,
  };
}

export function StorageSettings() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading storage…");
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [confirm, setConfirm] = useState<StorageSwitchResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (quiet: boolean) => {
    if ((await adminTokenStorage.getAccessToken()) === null) {
      window.location.assign("/login");
      return;
    }
    if (!quiet) {
      setState("loading");
    }
    try {
      const me = await createAdminApiClient().me();
      if (!me.roles.includes("ADMIN")) {
        setState("error");
        setMessage("This account is not an admin.");
        return;
      }
      const next = await createAdminApiClient().getAdminStorage();
      setOverview(next);
      setState("success");
      setMessage(
        "New uploads use the active storage. Each file keeps the backend it was saved on.",
      );
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load storage.");
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const migrationStatus = overview?.migration?.status;
  useEffect(() => {
    if (migrationStatus !== "RUNNING" && migrationStatus !== "PENDING") {
      return;
    }
    const timer = window.setInterval(() => {
      void load(true);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [load, migrationStatus]);

  const option =
    overview?.providers.find((item) => item.id === draft.provider) ?? overview?.providers[0];
  const transferRunning = migrationStatus === "RUNNING" || migrationStatus === "PENDING";

  async function submit(migrate?: boolean): Promise<void> {
    setBusy(true);
    setState("loading");
    try {
      const result = await createAdminApiClient().switchAdminStorage({
        ...draft,
        ...(migrate === undefined ? {} : { migrate }),
      });
      if (result.outcome === "confirmation_required") {
        setConfirm(result);
        setOverview(result.overview);
        setState("success");
        setMessage("Existing files can stay where they are, or move to the new storage.");
        return;
      }
      setConfirm(null);
      setDraft((current) => ({ ...current, accessKey: "", secretKey: "" }));
      setOverview(result.overview);
      setState("success");
      setMessage(
        result.outcome === "migration_started"
          ? "Transfer started. Progress stays on this page."
          : "Storage updated. New uploads use the selected backend.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to update storage.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelTransfer(migration: StorageMigrationView): Promise<void> {
    setBusy(true);
    try {
      setOverview(await createAdminApiClient().cancelAdminStorageMigration(migration.id));
      setState("success");
      setMessage("Transfer stopped. Files already copied stay on the new storage.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to stop the transfer.");
    } finally {
      setBusy(false);
    }
  }

  async function retryTransfer(migration: StorageMigrationView): Promise<void> {
    setBusy(true);
    try {
      setOverview(await createAdminApiClient().retryAdminStorageMigration(migration.id));
      setState("success");
      setMessage("Transfer resumed.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to resume the transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface state={state} title="File storage">
      <p>{message}</p>
      {overview === null ? null : (
        <div className="stack">
          <p>
            Active: <strong>{overview.active.label}</strong> ({overview.active.provider}) ·{" "}
            {overview.active.readyAssetCount} ready files
            {overview.active.bucket.length > 0 ? ` · bucket ${overview.active.bucket}` : ""}
          </p>
          <MigrationPanel
            migration={overview.migration}
            busy={busy}
            onCancel={(migration) => void cancelTransfer(migration)}
            onRetry={(migration) => void retryTransfer(migration)}
          />
          {confirm !== null ? (
            <fieldset className="admin-fieldset">
              <legend>Move existing files?</legend>
              <p>
                {confirm.pendingAssetCount} files ({formatBytes(confirm.pendingBytes)}) are on the
                current storage. Transfer them before new uploads use {draft.provider}?
              </p>
              <div className="actions">
                <Button disabled={busy} onClick={() => void submit(true)}>
                  Transfer existing files
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void submit(false)}>
                  Keep existing files where they are
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
              </div>
            </fieldset>
          ) : null}
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirm(null);
              void submit(undefined);
            }}
          >
            <fieldset className="admin-fieldset">
              <legend>Backend</legend>
              <div className="admin-choice-list" role="radiogroup" aria-label="Storage backend">
                {overview.providers.map((item) => (
                  <label key={item.id} className="admin-choice">
                    <input
                      type="radio"
                      name="storageProvider"
                      value={item.id}
                      checked={draft.provider === item.id}
                      disabled={busy || transferRunning}
                      onChange={() => setDraft((current) => applyProvider(current, item))}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <span className="hint">{item.summary}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {option?.needsCredentials === true ? (
              <fieldset className="admin-fieldset">
                <legend>Connection</legend>
                <label>
                  Endpoint
                  <input
                    value={draft.endpoint}
                    placeholder={option.endpointHint}
                    autoComplete="off"
                    disabled={busy || transferRunning}
                    onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
                  />
                </label>
                <label>
                  Region
                  <input
                    value={draft.region}
                    autoComplete="off"
                    disabled={busy || transferRunning}
                    onChange={(event) => setDraft({ ...draft, region: event.target.value })}
                  />
                </label>
                <label>
                  Bucket
                  <input
                    value={draft.bucket}
                    autoComplete="off"
                    disabled={busy || transferRunning}
                    onChange={(event) => setDraft({ ...draft, bucket: event.target.value })}
                  />
                </label>
                <label>
                  Access key
                  <input
                    value={draft.accessKey}
                    autoComplete="off"
                    disabled={busy || transferRunning}
                    onChange={(event) => setDraft({ ...draft, accessKey: event.target.value })}
                  />
                </label>
                <label>
                  Secret
                  <input
                    type="password"
                    value={draft.secretKey}
                    autoComplete="new-password"
                    disabled={busy || transferRunning}
                    onChange={(event) => setDraft({ ...draft, secretKey: event.target.value })}
                  />
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.forcePathStyle}
                    disabled={busy || transferRunning}
                    onChange={(event) =>
                      setDraft({ ...draft, forcePathStyle: event.target.checked })
                    }
                  />
                  Path-style URLs
                </label>
              </fieldset>
            ) : (
              <fieldset className="admin-fieldset">
                <legend>Server folder</legend>
                <label>
                  Directory
                  <input
                    value={draft.localRoot}
                    placeholder="Leave empty for the server default"
                    autoComplete="off"
                    disabled={busy || transferRunning}
                    onChange={(event) => setDraft({ ...draft, localRoot: event.target.value })}
                  />
                </label>
              </fieldset>
            )}
            <label>
              Public base URL
              <input
                value={draft.publicBaseUrl}
                placeholder="Leave empty to serve files through HASUT"
                autoComplete="off"
                disabled={busy || transferRunning}
                onChange={(event) => setDraft({ ...draft, publicBaseUrl: event.target.value })}
              />
            </label>
            <p className="hint">
              Secrets are stored encrypted and are not shown again. A public URL is only for a
              bucket or CDN that browsers can read directly.
            </p>
            <div className="actions">
              <Button type="submit" disabled={busy || transferRunning}>
                {busy ? "Checking…" : "Save storage"}
              </Button>
            </div>
          </form>
          {overview.profiles.length > 1 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Backend</th>
                  <th>Bucket</th>
                  <th>Ready files</th>
                  <th>Key</th>
                </tr>
              </thead>
              <tbody>
                {overview.profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      {profile.label}
                      {profile.isActive ? " (active)" : ""}
                    </td>
                    <td>{profile.bucket}</td>
                    <td>{profile.readyAssetCount}</td>
                    <td>{profile.accessKeyHint ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      )}
    </Surface>
  );
}

function MigrationPanel({
  migration,
  busy,
  onCancel,
  onRetry,
}: {
  migration: StorageMigrationView | null;
  busy: boolean;
  onCancel: (migration: StorageMigrationView) => void;
  onRetry: (migration: StorageMigrationView) => void;
}) {
  if (migration === null) {
    return <p className="hint">No transfer has run yet.</p>;
  }
  const done = migration.copiedCount + migration.skippedCount + migration.failedCount;
  const width = migration.totalCount === 0 ? 0 : Math.round((done / migration.totalCount) * 100);
  return (
    <fieldset className="admin-fieldset">
      <legend>Transfer log</legend>
      <p>
        {migration.fromLabel} → {migration.toLabel} · {migration.status} · {done} of{" "}
        {migration.totalCount} files ({migration.copiedCount} copied, {migration.skippedCount}{" "}
        already there, {migration.failedCount} failed)
      </p>
      {migration.errorMessage.length > 0 ? <p>{migration.errorMessage}</p> : null}
      <div
        style={{
          height: 8,
          background: cssVar("border"),
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            background: cssVar("primary"),
          }}
        />
      </div>
      <div className="actions">
        {migration.status === "RUNNING" || migration.status === "PENDING" ? (
          <Button variant="secondary" disabled={busy} onClick={() => onCancel(migration)}>
            Stop transfer
          </Button>
        ) : null}
        {migration.status === "FAILED" || migration.status === "CANCELLED" ? (
          <Button variant="secondary" disabled={busy} onClick={() => onRetry(migration)}>
            Resume failed files
          </Button>
        ) : null}
      </div>
      {migration.items.length === 0 ? (
        <p className="hint">Waiting for the first file.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Size</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {migration.items.map((item) => (
              <tr key={item.id}>
                <td>{item.objectKey}</td>
                <td>{item.status}</td>
                <td>{formatBytes(item.byteSize)}</td>
                <td>{item.errorMessage.length > 0 ? item.errorMessage : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </fieldset>
  );
}
