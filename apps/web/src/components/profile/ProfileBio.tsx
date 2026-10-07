import { MapPin } from "lucide-react";

export function ProfileBio({
  bio,
  statusText,
  locationLabel,
  modeLabel,
}: {
  bio: string;
  statusText: string;
  locationLabel: string | null;
  modeLabel: string | null;
}) {
  const trimmed = bio.trim();
  const status = statusText.trim();
  return (
    <div className="grid gap-1 text-left">
      {trimmed.length > 0 ? <p className="m-0 text-sm leading-relaxed">{trimmed}</p> : null}
      {status.length > 0 ? <p className="m-0 text-sm text-muted-foreground">{status}</p> : null}
      {locationLabel !== null || modeLabel !== null ? (
        <p className="m-0 flex items-center gap-1 text-sm text-muted-foreground">
          {locationLabel !== null ? (
            <>
              <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{locationLabel}</span>
            </>
          ) : null}
          {locationLabel !== null && modeLabel !== null ? <span aria-hidden="true">·</span> : null}
          {modeLabel !== null ? <span>{modeLabel}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
