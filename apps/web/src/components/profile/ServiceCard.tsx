import { Badge, NameMark } from "@hasut/ui";

export function ServiceCard({
  href,
  title,
  description,
  categoryLabel,
  providerName,
  priceLabel,
  ratingLabel,
  reviewCount,
  used,
  paused,
}: {
  href: string;
  title: string;
  description: string;
  categoryLabel: string | null;
  providerName: string;
  priceLabel: string | null;
  ratingLabel: string | null;
  reviewCount: number | null;
  used: boolean;
  paused: boolean;
}) {
  return (
    <a
      href={href}
      className="block overflow-hidden rounded-xl border border-border bg-card text-inherit no-underline shadow-sm transition hover:shadow-md"
    >
      <NameMark name={categoryLabel ?? title} height={132} />
      <div className="grid gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          {categoryLabel !== null ? (
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-primary">
              {categoryLabel}
            </p>
          ) : (
            <span />
          )}
          {used ? <Badge>Used</Badge> : null}
          {!used && paused ? <Badge variant="secondary">Paused</Badge> : null}
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="m-0 text-sm text-muted-foreground">{providerName}</p>
        {description.trim().length > 0 ? (
          <p className="m-0 line-clamp-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {priceLabel !== null ? <p className="m-0 text-sm font-medium">{priceLabel}</p> : null}
        {ratingLabel !== null && reviewCount !== null ? (
          <p className="m-0 text-sm">
            <span className="text-accent">★</span> {ratingLabel}
            <span className="text-muted-foreground"> · {reviewCount} reviews</span>
          </p>
        ) : null}
      </div>
    </a>
  );
}
