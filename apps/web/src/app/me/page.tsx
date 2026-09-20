"use client";

import { HasutApiError } from "@hasut/api-client";
import type {
  CurrentModeView,
  OwnerLocation,
  OwnerMemberProfile,
  ServiceOfferingView,
} from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { createWebApiClient } from "../../lib/api";

export default function MePage() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading your profile…");
  const [profile, setProfile] = useState<OwnerMemberProfile | null>(null);
  const [location, setLocation] = useState<OwnerLocation | null>(null);
  const [modes, setModes] = useState<CurrentModeView[]>([]);
  const [offerings, setOfferings] = useState<ServiceOfferingView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const client = createWebApiClient();
      const [mine, loc, catalog] = await Promise.all([
        client.getMyProfile(),
        client.getMyLocation(),
        client.listCurrentModes(),
      ]);
      setProfile(mine);
      setLocation(loc);
      setModes(catalog);
      const listed = await client.listMyServices().catch(() => []);
      setOfferings(listed);
      setState("success");
      setMessage("Edit your public profile and approximate location. Phone stays private.");
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login?next=/me");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load your profile.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <AppNav />
      <h1>Me</h1>
      <Surface state={state} title="Profile">
        <p>{message}</p>
        {profile !== null ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void createWebApiClient()
                .putMyProfile({
                  displayName: String(data.get("displayName") ?? ""),
                  bio: String(data.get("bio") ?? ""),
                  currentModeCode: String(data.get("mode") ?? "") || null,
                  statusText: String(data.get("statusText") ?? ""),
                  isDiscoverable: data.get("discoverable") === "on",
                })
                .then(() => {
                  setMessage("Profile saved.");
                  return load();
                });
            }}
          >
            <label>
              Display name
              <input name="displayName" defaultValue={profile.displayName} required />
            </label>
            <label>
              Bio
              <textarea name="bio" defaultValue={profile.bio} />
            </label>
            <label>
              Current mode
              <select name="mode" defaultValue={profile.currentMode?.code ?? ""}>
                <option value="">None</option>
                {modes.map((mode) => (
                  <option key={mode.code} value={mode.code}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status text
              <input name="statusText" defaultValue={profile.statusText} />
            </label>
            <label>
              <input type="checkbox" name="discoverable" defaultChecked={profile.isDiscoverable} />
              Discoverable on the map
            </label>
            <Button type="submit">Save profile</Button>
          </form>
        ) : null}
      </Surface>
      <Surface state={state} title="Location">
        <p>
          {location?.approximate?.label ??
            "No public location yet. Sharing GPS stores exact coordinates privately and a snapped pin publicly."}
        </p>
        <Button
          onClick={() => {
            navigator.geolocation.getCurrentPosition((position) => {
              void createWebApiClient()
                .putMyLocation({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracyMeters: position.coords.accuracy,
                })
                .then(load);
            });
          }}
        >
          Use current location
        </Button>
      </Surface>
      <Surface state={offerings.length === 0 ? "empty" : "success"} title="Service offerings">
        <p>Listings only — no booking or checkout.</p>
        {offerings.map((item) => (
          <p key={item.id}>
            {item.title}
            {item.displayPriceAmount !== null ? ` · ${item.displayPriceAmount}` : ""}
          </p>
        ))}
        <a href="/offer-a-service">Offer a service</a>
      </Surface>
      <p>
        <a href="/story">Add a presence story</a>
      </p>
    </main>
  );
}
