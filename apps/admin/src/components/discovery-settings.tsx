"use client";

import { HasutApiError } from "@hasut/api-client";
import { MAP_BASEMAP_OPTIONS } from "@hasut/config";
import type { DiscoveryPolicyView, DiscoveryRankingWeightsView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

const RANKING_KEYS = [
  "distance",
  "categoryRelevance",
  "availability",
  "verification",
  "rating",
  "activity",
] as const;

function rankingLabel(key: (typeof RANKING_KEYS)[number]): string {
  if (key === "categoryRelevance") {
    return "Category relevance";
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function DiscoverySettings() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading discovery configuration…");
  const [policy, setPolicy] = useState<DiscoveryPolicyView | null>(null);
  const [weights, setWeights] = useState<DiscoveryRankingWeightsView | null>(null);

  const load = useCallback(async () => {
    if ((await adminTokenStorage.getAccessToken()) === null) {
      window.location.assign("/login");
      return;
    }
    setState("loading");
    try {
      const me = await createAdminApiClient().me();
      if (!me.roles.includes("ADMIN")) {
        setState("error");
        setMessage("This account is not an admin.");
        return;
      }
      const [nextPolicy, nextWeights] = await Promise.all([
        createAdminApiClient().getAdminDiscoveryPolicy(),
        createAdminApiClient().getAdminDiscoveryWeights(),
      ]);
      setPolicy(nextPolicy);
      setWeights(nextWeights);
      setState("success");
      setMessage("These defaults are read by discovery without a redeploy.");
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return;
      }
      setState("error");
      setMessage(
        error instanceof HasutApiError ? error.message : "Unable to load discovery settings.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(): Promise<void> {
    if (policy === null || weights === null) {
      return;
    }
    setState("loading");
    try {
      await createAdminApiClient().patchAdminDiscoveryPolicy({
        defaultRadiusMeters: policy.defaultRadiusMeters,
        clusterCellMeters: policy.clusterCellMeters,
        includeMembers: policy.includeMembers,
        mapProvider: policy.mapProvider,
        mapCustomTileUrl: policy.mapCustomTileUrl,
      });
      await createAdminApiClient().patchAdminDiscoveryWeights(weights);
      await load();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof HasutApiError ? error.message : "Unable to save discovery settings.",
      );
    }
  }

  return (
    <Surface state={state} title="Discovery policy">
      <p>{message}</p>
      {policy !== null ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className="admin-fieldset">
            <legend>Search defaults</legend>
            <label>
              Default radius (meters)
              <input
                type="number"
                min={policy.minRadiusMeters}
                max={policy.maxRadiusMeters}
                value={policy.defaultRadiusMeters}
                onChange={(event) =>
                  setPolicy({ ...policy, defaultRadiusMeters: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Cluster cell (meters)
              <input
                type="number"
                min={1}
                value={policy.clusterCellMeters}
                onChange={(event) =>
                  setPolicy({ ...policy, clusterCellMeters: Number(event.target.value) })
                }
              />
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={policy.includeMembers}
                onChange={(event) => setPolicy({ ...policy, includeMembers: event.target.checked })}
              />
              Include members when privacy permits
            </label>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Basemap</legend>
            <p className="hint">
              Primary tiles, then up to two fallbacks. MapTiler needs MAPTILER_API_KEY; Stadia can
              run without a key and still accepts STADIA_API_KEY; CARTO is last resort.
            </p>
            <div className="admin-choice-list" role="radiogroup" aria-label="Basemap provider">
              {MAP_BASEMAP_OPTIONS.map((option) => (
                <label key={option.id} className="admin-choice">
                  <input
                    type="radio"
                    name="mapProvider"
                    value={option.id}
                    checked={policy.mapProvider === option.id}
                    onChange={() => setPolicy({ ...policy, mapProvider: option.id })}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <span className="hint">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <label>
              Custom tile URL (optional)
              <input
                value={policy.mapCustomTileUrl}
                onChange={(event) => setPolicy({ ...policy, mapCustomTileUrl: event.target.value })}
                placeholder="https://tiles.example/{z}/{x}/{y}.png"
                autoComplete="off"
              />
            </label>
            <p className="hint">
              Clients load {policy.mapTileUrl}
              {policy.mapFallbackTileUrls.length > 0
                ? `, then ${policy.mapFallbackTileUrls.join(", ")}`
                : ""}
              .
            </p>
          </fieldset>

          {weights !== null ? (
            <fieldset className="admin-fieldset">
              <legend>Ranking weights</legend>
              <div className="admin-weight-grid">
                {RANKING_KEYS.map((key) => (
                  <label key={key}>
                    {rankingLabel(key)}
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={weights[key]}
                      onChange={(event) =>
                        setWeights({ ...weights, [key]: Number(event.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="actions">
            <Button type="submit" disabled={state === "loading"}>
              {state === "loading" ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      ) : null}
    </Surface>
  );
}
