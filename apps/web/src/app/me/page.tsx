"use client";

import { HasutApiError } from "@hasut/api-client";
import type {
  ConnectionView,
  CurrentModeView,
  LiveSessionView,
  OwnerLocation,
  OwnerMemberProfile,
  ProfessionalOnboarding,
  ServiceOfferingView,
  StoryView,
} from "@hasut/types";
import { Button } from "@hasut/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { EditProfileDialog, type ProfileDraft } from "../../components/profile/EditProfileDialog";
import { LiveGrid } from "../../components/profile/LiveGrid";
import { PresenceGrid } from "../../components/profile/PresenceGrid";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { ProfileSkeleton } from "../../components/profile/ProfileSkeleton";
import { ProfileTabs, type ProfileTab } from "../../components/profile/ProfileTabs";
import { ServicesGrid, type OfferingCardModel } from "../../components/profile/ServicesGrid";
import { createWebApiClient } from "../../lib/api";
import { flattenCategories } from "../../lib/categories";
import { isUnauthenticated, redirectToLogin } from "../../lib/member-nav";
import { acceptedAvatarType } from "../../lib/profile-photo";
import {
  connectionStats,
  serviceTabState,
  shareOrCopy,
  storyEngagement,
  type PresenceSort,
} from "../../lib/profile-model";

const TABS: readonly ProfileTab[] = [
  { id: "presence", label: "Presence" },
  { id: "live", label: "Live" },
  { id: "services", label: "Services" },
];

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof HasutApiError ? error.message : fallback;
}

export default function MePage() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [message, setMessage] = useState("Loading your profile…");
  const [profile, setProfile] = useState<OwnerMemberProfile | null>(null);
  const [location, setLocation] = useState<OwnerLocation | null>(null);
  const [modes, setModes] = useState<CurrentModeView[]>([]);
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [onboarding, setOnboarding] = useState<ProfessionalOnboarding | null>(null);
  const [offerings, setOfferings] = useState<ServiceOfferingView[]>([]);
  const [stories, setStories] = useState<StoryView[]>([]);
  const [live, setLive] = useState<LiveSessionView | null>(null);
  const [rating, setRating] = useState<{ avgRating: number; count: number } | null>(null);
  const [engagement, setEngagement] = useState<Record<string, { views: number; likes: number }>>(
    {},
  );
  const [engagementReady, setEngagementReady] = useState(false);
  const [tab, setTab] = useState<ProfileTab["id"]>("presence");
  const [sort, setSort] = useState<PresenceSort>("latest");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const client = createWebApiClient();
      const [mine, loc, catalog, network] = await Promise.all([
        client.getMyProfile(),
        client.getMyLocation(),
        client.listCurrentModes(),
        client.listConnections(),
      ]);
      const [posted, listed, board, session] = await Promise.all([
        client.listMyStories().catch(() => [] as StoryView[]),
        client.listMyServices().catch(() => [] as ServiceOfferingView[]),
        client.getProfessionalOnboarding().catch(() => null),
        client.getMyLive().catch(() => null),
      ]);
      const professional = board?.professional ?? null;
      const aggregate =
        professional !== null && (board?.status === "ACTIVE" || board?.status === "PAUSED")
          ? await client.getReviewAggregate("PROFESSIONAL", professional.id).catch(() => null)
          : null;
      setProfile(mine);
      setLocation(loc);
      setModes(catalog);
      setConnections(network);
      setStories(posted);
      setOfferings(listed);
      setOnboarding(board);
      setLive(session);
      setRating(aggregate);
      setState("ready");
    } catch (error) {
      if (isUnauthenticated(error)) {
        redirectToLogin("/me");
        return;
      }
      setState("error");
      setMessage(messageFrom(error, "Unable to load your profile."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (stories.length === 0) {
      setEngagement({});
      setEngagementReady(true);
      return;
    }
    let cancelled = false;
    setEngagementReady(false);
    void Promise.all(
      stories.map(async (story) => {
        try {
          const list = await createWebApiClient().listStoryViewers(story.id);
          return [story.id, storyEngagement(list.viewers)] as const;
        } catch {
          return [story.id, null] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) {
        return;
      }
      const next: Record<string, { views: number; likes: number }> = {};
      for (const [id, stats] of rows) {
        if (stats !== null) {
          next[id] = stats;
        }
      }
      setEngagement(next);
      setEngagementReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [stories]);

  const stats = useMemo(() => connectionStats(connections), [connections]);
  const reviewCount = rating?.count ?? 0;
  const ratingValue = reviewCount > 0 ? (rating?.avgRating ?? null) : null;
  const professional = onboarding?.professional ?? null;
  const identityVerified = professional?.identityVerificationStatus === "VERIFIED";
  const showProfessional = onboarding?.status === "ACTIVE" || onboarding?.status === "PAUSED";
  const locationLabel = location?.approximate?.label ?? profile?.approximateLocation?.label ?? null;
  const categoryLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const category of flattenCategories(onboarding?.categories ?? [])) {
      labels.set(category.id, category.name);
    }
    return labels;
  }, [onboarding]);
  const offeringCards: OfferingCardModel[] = offerings.map((item) => ({
    ...item,
    // Booking history and per-offering reviews are not on the services payload.
    used: false,
    reviewCount: null,
    rating: null,
    active: item.isActive,
    categoryLabel: categoryLabels.get(item.categoryId) ?? null,
  }));

  async function saveProfile(draft: ProfileDraft): Promise<void> {
    setSaving(true);
    setFormError(null);
    try {
      const next = await createWebApiClient().putMyProfile({
        displayName: draft.displayName,
        bio: draft.bio,
        currentModeCode: draft.currentModeCode,
        statusText: draft.statusText,
        isDiscoverable: draft.isDiscoverable,
      });
      setProfile(next);
      setEditing(false);
      setShareNote("Profile saved.");
    } catch (error) {
      setFormError(messageFrom(error, "Unable to save your profile."));
    } finally {
      setSaving(false);
    }
  }

  async function useCurrentLocation(): Promise<void> {
    if (typeof navigator === "undefined" || navigator.geolocation === undefined) {
      throw new Error("Location is not available in this browser.");
    }
    setLocating(true);
    setFormError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, () =>
          reject(new Error("Location permission was denied.")),
        );
      });
      const next = await createWebApiClient().putMyLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      });
      setLocation(next);
      setProfile((current) =>
        current === null ? current : { ...current, approximateLocation: next.approximate },
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update location.");
    } finally {
      setLocating(false);
    }
  }

  async function uploadPhoto(file: File): Promise<void> {
    if (!acceptedAvatarType(file.type)) {
      setFormError("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    setPhotoBusy(true);
    setFormError(null);
    try {
      const client = createWebApiClient();
      const presign = await client.presignMedia({
        purpose: "AVATAR",
        mimeType: file.type,
        byteSize: file.size,
      });
      await client.uploadPresigned(presign.uploadUrl, file, presign.headers);
      await client.completeMedia({ mediaId: presign.mediaId });
      const next = await client.patchMyProfile({ photoMediaId: presign.mediaId });
      setProfile(next);
      setShareNote("Photo updated.");
    } catch (error) {
      setFormError(messageFrom(error, "Unable to update your photo."));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function shareProfile(): Promise<void> {
    if (profile === null) {
      return;
    }
    const url = `${window.location.origin}/members/${profile.id}`;
    try {
      const result = await shareOrCopy({
        url,
        title: profile.displayName,
        share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
        writeText: (value) => navigator.clipboard.writeText(value),
      });
      if (result === "copied") {
        setShareNote("Profile link copied.");
      } else if (result === "shared") {
        setShareNote("Profile shared.");
      }
    } catch {
      setShareNote("Unable to share this profile.");
    }
  }

  return (
    <main className="me-profile">
      <AppNav />
      <h1 className="sr-only">Profile</h1>
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="profile-file"
        aria-label="Upload profile photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) {
            void uploadPhoto(file);
          }
        }}
      />
      {state === "loading" ? <ProfileSkeleton /> : null}
      {state === "error" ? (
        <div className="py-10">
          <p className="m-0" role="alert">
            {message}
          </p>
          <Button className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}
      {state === "ready" && profile !== null ? (
        <div className="grid gap-6">
          <ProfileHeader
            profile={{
              ...profile,
              approximateLocation: location?.approximate ?? profile.approximateLocation,
            }}
            patrons={stats.patrons}
            requests={stats.requests}
            rating={ratingValue}
            reviewCount={reviewCount}
            identityVerified={identityVerified}
            professional={showProfessional}
            hasPresence={stories.some((story) => story.kind !== "LIVE")}
            isLive={live?.status === "LIVE"}
            photoBusy={photoBusy}
            shareNote={shareNote}
            onEdit={() => {
              setFormError(null);
              setEditing(true);
            }}
            onShare={() => void shareProfile()}
            onChangePhoto={() => photoInput.current?.click()}
          />
          {formError !== null && !editing ? (
            <p className="m-0 text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <ProfileTabs tabs={TABS} active={tab} onChange={setTab} />
          <div
            role="tabpanel"
            id="profile-panel-presence"
            aria-labelledby="profile-tab-presence"
            hidden={tab !== "presence"}
          >
            {tab === "presence" ? (
              <PresenceGrid
                stories={stories}
                memberId={profile.id}
                engagement={engagement}
                engagementReady={engagementReady}
                sort={sort}
                onSort={setSort}
                nowMs={nowMs}
              />
            ) : null}
          </div>
          <div
            role="tabpanel"
            id="profile-panel-live"
            aria-labelledby="profile-tab-live"
            hidden={tab !== "live"}
          >
            {tab === "live" ? (
              <LiveGrid
                stories={stories}
                live={live}
                memberId={profile.id}
                engagement={engagement}
                engagementReady={engagementReady}
                nowMs={nowMs}
              />
            ) : null}
          </div>
          <div
            role="tabpanel"
            id="profile-panel-services"
            aria-labelledby="profile-tab-services"
            hidden={tab !== "services"}
          >
            {tab === "services" ? (
              <ServicesGrid
                state={serviceTabState({
                  onboardingStatus: onboarding?.status ?? null,
                  offeringCount: offerings.length,
                })}
                offerings={offeringCards}
                providerName={profile.displayName}
                professionalRating={ratingValue}
                professionalReviewCount={reviewCount}
              />
            ) : null}
          </div>
          <EditProfileDialog
            open={editing}
            onOpenChange={(next) => {
              setEditing(next);
              if (!next) {
                setFormError(null);
              }
            }}
            profile={profile}
            modes={modes}
            locationLabel={locationLabel}
            saving={saving}
            locating={locating}
            photoBusy={photoBusy}
            error={formError}
            onSave={saveProfile}
            onLocate={useCurrentLocation}
            onChangePhoto={() => photoInput.current?.click()}
          />
        </div>
      ) : null}
    </main>
  );
}
