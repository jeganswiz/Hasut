import type { CSSProperties } from "react";
import { cssVar } from "./tokens";

export function Avatar({
  photoUrl,
  initials,
  size = 40,
  ring = "idle",
  label,
}: {
  photoUrl: string | null;
  initials: string;
  size?: number;
  ring?: "idle" | "available" | "live";
  label?: string;
}) {
  const ringColor =
    ring === "live"
      ? cssVar("danger")
      : ring === "available"
        ? cssVar("success")
        : cssVar("primary");
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `3px solid ${ringColor}`,
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    background: cssVar("surface"),
    color: cssVar("text"),
    fontWeight: 700,
    fontSize: Math.max(10, Math.round(size * 0.32)),
    flexShrink: 0,
  };
  return (
    <span style={style} aria-label={label ?? initials}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials
      )}
    </span>
  );
}
