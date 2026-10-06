import type { ReactNode } from "react";
import { NameMark } from "./name-mark";
import { cssVar } from "./tokens";
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
      style={{
        minWidth: 148,
        border: `1px solid ${active ? "transparent" : cssVar("border")}`,
        background: active ? cssVar("primary") : cssVar("surface"),
        color: active ? cssVar("textOnPrimary") : cssVar("text"),
        borderRadius: cssVar("cardRadius"),
        padding: 0,
        overflow: "hidden",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {photoUrl !== null && photoUrl.length > 0 ? (
        <img
          src={photoUrl}
          alt=""
          style={{ display: "block", width: "100%", height: 88, objectFit: "cover" }}
        />
      ) : (
        <NameMark name={title} height={88} />
      )}
      <span style={{ display: "block", padding: 12 }}>
        {children}
        <strong style={{ display: "block", marginTop: children === undefined ? 0 : 8 }}>
          {title}
        </strong>
        <span
          style={{ display: "block", marginTop: 4, color: active ? cssVar("accent") : undefined }}
        >
          <Rating value={rating} />
        </span>
        <span style={{ color: active ? cssVar("textOnPrimary") : cssVar("mutedText") }}>
          {distance}
        </span>
      </span>
    </button>
  );
}
