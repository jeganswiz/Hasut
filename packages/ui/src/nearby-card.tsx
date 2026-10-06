import type { ReactNode } from "react";
import { cn } from "./lib/utils";
import { NameMark } from "./name-mark";
import { Rating } from "./rating";

export function NearbyCard({
  active,
  title,
  rating,
  distance,
  photoUrl = null,
  children,
  onClick,
}: {
  active?: boolean;
  title: string;
  rating: number | null;
  distance: string;
  photoUrl?: string | null;
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-36 overflow-hidden rounded-lg p-0 text-left",
        active
          ? "border border-transparent bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground",
      )}
    >
      {photoUrl !== null && photoUrl.length > 0 ? (
        <img src={photoUrl} alt="" className="block h-[88px] w-full object-cover" />
      ) : (
        <NameMark name={title} height={88} />
      )}
      <span className="block p-3">
        {children}
        <strong className={cn("block", children === undefined ? "mt-0" : "mt-2")}>{title}</strong>
        <span className={cn("mt-1 block", active && "text-accent")}>
          <Rating value={rating} />
        </span>
        <span className={active ? "text-primary-foreground" : "text-muted-foreground"}>
          {distance}
        </span>
      </span>
    </button>
  );
}
