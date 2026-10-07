import { compactCount, ratingLabel } from "../../lib/profile-model";

function StatLink({ value, label, href }: { value: string; label: string; href: string }) {
  return (
    <a href={href} className="text-inherit no-underline">
      <span className="block text-lg font-semibold leading-none">{value}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </a>
  );
}

export function ProfileStats({
  patrons,
  requests,
  rating,
  reviewCount,
}: {
  patrons: number;
  requests: number;
  rating: number | null;
  reviewCount: number;
}) {
  const ratingText = ratingLabel(rating, reviewCount);
  return (
    <div className="flex w-full justify-around gap-6 sm:justify-start sm:gap-10">
      <StatLink value={compactCount(patrons)} label="Patrons" href="/connections" />
      <StatLink value={compactCount(requests)} label="Requests" href="/connections" />
      <div>
        <span className="block text-lg font-semibold leading-none">
          {ratingText === "New" ? (
            "New"
          ) : (
            <>
              <span className="text-accent">★</span> {ratingText}
            </>
          )}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">Rating</span>
      </div>
    </div>
  );
}
