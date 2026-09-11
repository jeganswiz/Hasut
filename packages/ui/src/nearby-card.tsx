import type { ReactNode } from "react";
import { cssVar } from "./tokens";
import { Rating } from "./rating";

export function NearbyCard({
  active,
  title,
  rating,
  distance,
  children,
  onClick,
}: {
  active?: boolean;
  title: string;
  rating: number | null;
  distance: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 132,
        border: `1px solid ${active ? "transparent" : cssVar("border")}`,
        background: active ? cssVar("primary") : cssVar("surface"),
        color: active ? cssVar("textOnPrimary") : cssVar("text"),
        borderRadius: cssVar("cardRadius"),
        padding: 12,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {children}
      <strong style={{ display: "block", marginTop: 8 }}>{title}</strong>
      <span
        style={{ display: "block", marginTop: 4, color: active ? cssVar("accent") : undefined }}
      >
        <Rating value={rating} />
      </span>
      <span style={{ color: active ? cssVar("textOnPrimary") : cssVar("mutedText") }}>
        {distance}
      </span>
    </button>
  );
}
