import { Button } from "./button";
import { NameMark } from "./name-mark";
import { Rating } from "./rating";

export function ServiceCard({
  title,
  categoryLabel,
  rating,
  photoUrl,
  coverUrl = null,
  providerName,
  onOpen,
}: {
  title: string;
  categoryLabel: string | null;
  rating: number | null;
  photoUrl: string | null;
  /** Category picture when one is stored. Otherwise a picture made from the category name. */
  coverUrl?: string | null;
  providerName: string;
  onOpen?: () => void;
}) {
  const cover = coverUrl ?? (categoryLabel === null ? photoUrl : null);
  const coverName = categoryLabel ?? title;
  return (
    <article className="min-w-[220px] overflow-hidden rounded-lg border border-border bg-card">
      {cover !== null && cover.length > 0 ? (
        <img src={cover} alt="" className="block h-[110px] w-full object-cover" />
      ) : (
        <NameMark name={coverName} height={110} />
      )}
      <div className="p-3">
        <Rating value={rating} />
        {categoryLabel !== null ? (
          <p className="text-xs font-bold uppercase text-primary">{categoryLabel}</p>
        ) : null}
        <h3 className="my-1 text-base">{title}</h3>
        <p className="m-0 text-muted-foreground">{providerName}</p>
        <Button type="button" className="mt-3 w-full" onClick={onOpen}>
          View profile
        </Button>
      </div>
    </article>
  );
}
