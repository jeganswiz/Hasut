"use client";

import { HasutApiError } from "@hasut/api-client";
import type { DiscoveryPolicyView, DiscoveryRankingWeightsView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

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
    <Surface state={state} title="Discovery">
      <p>{message}</p>
      {policy !== null ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            Default radius (meters)
            <input
              type="number"
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
              value={policy.clusterCellMeters}
              onChange={(event) =>
                setPolicy({ ...policy, clusterCellMeters: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={policy.includeMembers}
              onChange={(event) => setPolicy({ ...policy, includeMembers: event.target.checked })}
            />
            Include members when privacy permits
          </label>
          {weights !== null ? (
            <>
              <h3>Ranking weights</h3>
              {(
                [
                  "distance",
                  "categoryRelevance",
                  "availability",
                  "verification",
                  "rating",
                  "activity",
                ] as const
              ).map((key) => (
                <label key={key}>
                  {key}
                  <input
                    type="number"
                    step="0.01"
                    value={weights[key]}
                    onChange={(event) =>
                      setWeights({ ...weights, [key]: Number(event.target.value) })
                    }
                  />
                </label>
              ))}
            </>
          ) : null}
          <Button type="submit">Save</Button>
        </form>
      ) : null}
    </Surface>
  );
}
