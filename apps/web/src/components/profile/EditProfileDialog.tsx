"use client";

import type { CurrentModeView, OwnerMemberProfile } from "@hasut/types";
import { initialsFromName } from "@hasut/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Switch,
  Textarea,
} from "@hasut/ui";
import { Camera, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ProfileDraft {
  displayName: string;
  bio: string;
  currentModeCode: string | null;
  statusText: string;
  isDiscoverable: boolean;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  modes,
  locationLabel,
  saving,
  locating,
  photoBusy,
  error,
  onSave,
  onLocate,
  onChangePhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: OwnerMemberProfile;
  modes: CurrentModeView[];
  locationLabel: string | null;
  saving: boolean;
  locating: boolean;
  photoBusy: boolean;
  error: string | null;
  onSave: (draft: ProfileDraft) => Promise<void>;
  onLocate: () => Promise<void>;
  onChangePhoto: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [modeCode, setModeCode] = useState(profile.currentMode?.code ?? "");
  const [statusText, setStatusText] = useState(profile.statusText);
  const [discoverable, setDiscoverable] = useState(profile.isDiscoverable);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDisplayName(profile.displayName);
      setBio(profile.bio);
      setModeCode(profile.currentMode?.code ?? "");
      setStatusText(profile.statusText);
      setDiscoverable(profile.isDiscoverable);
    }
    wasOpen.current = open;
  }, [open, profile]);

  const busy = saving || locating || photoBusy;
  const initials = initialsFromName(profile.displayName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>Your phone number stays private.</DialogDescription>
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({
              displayName: displayName.trim(),
              bio,
              currentModeCode: modeCode.length > 0 ? modeCode : null,
              statusText,
              isDiscoverable: discoverable,
            });
          }}
        >
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-primary ring-2 ring-primary/30">
              {profile.photoUrl !== null ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.displayName}
                  className="size-full object-cover"
                />
              ) : (
                <span aria-hidden="true">{initials}</span>
              )}
            </span>
            <Button type="button" variant="secondary" disabled={busy} onClick={onChangePhoto}>
              <Camera className="size-4" aria-hidden="true" />
              {photoBusy ? "Uploading photo…" : "Change photo"}
            </Button>
          </div>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              maxLength={80}
              autoComplete="name"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Bio
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={280}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-muted-foreground">
              Current mode
              <select value={modeCode} onChange={(event) => setModeCode(event.target.value)}>
                <option value="">None</option>
                {modes.map((mode) => (
                  <option key={mode.code} value={mode.code}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm text-muted-foreground">
              Status text
              <input
                value={statusText}
                onChange={(event) => setStatusText(event.target.value)}
                maxLength={80}
              />
            </label>
          </div>
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Location</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="m-0 flex min-w-0 flex-1 items-center gap-1 text-sm">
                <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{locationLabel ?? "No public location yet"}</span>
              </p>
              <Button type="button" disabled={busy} onClick={() => void onLocate()}>
                {locating ? "Finding location…" : "Use current location"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span id="discoverable-label" className="text-sm">
              Discoverable on map
            </span>
            <Switch
              id="discoverable"
              labelledBy="discoverable-label"
              checked={discoverable}
              disabled={busy}
              onCheckedChange={setDiscoverable}
            />
          </div>
          {error !== null ? (
            <p className="m-0 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || displayName.trim().length === 0}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
