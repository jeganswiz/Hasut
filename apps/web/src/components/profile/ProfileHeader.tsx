import type { OwnerMemberProfile } from "@hasut/types";
import { initialsFromName } from "@hasut/utils";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@hasut/ui";
import { BadgeCheck, Camera, MoreHorizontal, Share2 } from "lucide-react";
import { ProfileBio } from "./ProfileBio";
import { ProfileStats } from "./ProfileStats";

function ProfileActions({
  onEdit,
  onShare,
  memberId,
  className,
}: {
  onEdit: () => void;
  onShare: () => void;
  memberId: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Button className="flex-1 sm:flex-none" onClick={onEdit}>
        Edit profile
      </Button>
      <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onShare}>
        <Share2 className="size-4" aria-hidden="true" />
        Share
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="More profile actions">
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={`/members/${memberId}`}>View public profile</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/connections">Connections</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ProfileHeader({
  profile,
  patrons,
  requests,
  rating,
  reviewCount,
  identityVerified,
  professional,
  hasPresence,
  isLive,
  onEdit,
  onShare,
  onChangePhoto,
  photoBusy,
  shareNote,
}: {
  profile: OwnerMemberProfile;
  patrons: number;
  requests: number;
  rating: number | null;
  reviewCount: number;
  identityVerified: boolean;
  professional: boolean;
  hasPresence: boolean;
  isLive: boolean;
  onEdit: () => void;
  onShare: () => void;
  onChangePhoto: () => void;
  photoBusy: boolean;
  shareNote: string | null;
}) {
  const initials = initialsFromName(profile.displayName);
  const ring = isLive ? "ring-destructive" : hasPresence ? "ring-primary" : "ring-primary/30";
  const bio = (
    <ProfileBio
      bio={profile.bio}
      statusText={profile.statusText}
      locationLabel={profile.approximateLocation?.label ?? null}
      modeLabel={profile.currentMode?.label ?? null}
    />
  );
  const stats = (
    <ProfileStats patrons={patrons} requests={requests} rating={rating} reviewCount={reviewCount} />
  );
  const actions = (className: string) => (
    <ProfileActions className={className} onEdit={onEdit} onShare={onShare} memberId={profile.id} />
  );

  return (
    <header>
      <div className="flex items-center gap-4 sm:items-start sm:gap-8">
        <div className="relative shrink-0">
          <span
            className={`grid size-[88px] place-items-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-primary ring-2 ring-offset-2 ring-offset-background sm:size-[104px] ${ring}`}
          >
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
          <button
            type="button"
            className="absolute bottom-0 right-0 grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-primary text-primary-foreground shadow-sm disabled:opacity-50"
            aria-label="Change profile photo"
            disabled={photoBusy}
            onClick={onChangePhoto}
          >
            <Camera className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {profile.displayName}
            </h2>
            {identityVerified ? (
              <BadgeCheck className="size-5 text-primary" aria-label="Identity verified" />
            ) : null}
            {professional ? <Badge variant="secondary">Professional</Badge> : null}
          </div>
          <div className="mt-2 hidden sm:block">{bio}</div>
          {actions("mt-4 hidden gap-2 sm:flex")}
          <div className="mt-5 hidden sm:block">{stats}</div>
        </div>
      </div>
      <div className="mt-5 sm:hidden">{stats}</div>
      {actions("mt-4 flex gap-2 sm:hidden")}
      <div className="mt-4 sm:hidden">{bio}</div>
      {shareNote !== null ? (
        <p className="m-0 mt-3 text-sm text-muted-foreground" role="status">
          {shareNote}
        </p>
      ) : null}
    </header>
  );
}
