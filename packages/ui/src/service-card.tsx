import { cssVar } from "./tokens";
import { Rating } from "./rating";

export function ServiceCard({
  title,
  categoryLabel,
  rating,
  photoUrl,
  providerName,
  onOpen,
}: {
  title: string;
  categoryLabel: string | null;
  rating: number | null;
  photoUrl: string | null;
  providerName: string;
  onOpen?: () => void;
}) {
  return (
    <article
      style={{
        minWidth: 220,
        background: cssVar("surface"),
        border: `1px solid ${cssVar("border")}`,
        borderRadius: cssVar("cardRadius"),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 110,
          background: photoUrl === null ? cssVar("secondary") : `center / cover url(${photoUrl})`,
        }}
      />
      <div style={{ padding: 12 }}>
        <Rating value={rating} />
        {categoryLabel !== null ? (
          <p
            style={{
              color: cssVar("primary"),
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: 12,
            }}
          >
            {categoryLabel}
          </p>
        ) : null}
        <h3 style={{ margin: "4px 0 8px", fontSize: 16 }}>{title}</h3>
        <p style={{ color: cssVar("mutedText"), margin: 0 }}>{providerName}</p>
        <button
          type="button"
          onClick={onOpen}
          style={{
            marginTop: 12,
            width: "100%",
            border: 0,
            background: cssVar("primary"),
            color: cssVar("textOnPrimary"),
            borderRadius: cssVar("buttonRadius"),
            padding: "10px 12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          View profile
        </button>
      </div>
    </article>
  );
}
