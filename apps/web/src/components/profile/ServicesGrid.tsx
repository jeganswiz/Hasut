import type { ServiceOfferingView } from "@hasut/types";
import { Button } from "@hasut/ui";
import { Briefcase } from "lucide-react";
import { ratingLabel as formatRating } from "../../lib/profile-model";
import { formatOfferingPrice, groupOfferings, type ServiceTabState } from "../../lib/profile-model";
import { ProfileEmptyState } from "./ProfileEmptyState";
import { ServiceCard } from "./ServiceCard";

export interface OfferingCardModel extends ServiceOfferingView {
  used: boolean;
  reviewCount: number | null;
  rating: number | null;
  active: boolean;
  categoryLabel: string | null;
}

export function ServicesGrid({
  state,
  offerings,
  providerName,
  professionalRating,
  professionalReviewCount,
}: {
  state: ServiceTabState;
  offerings: OfferingCardModel[];
  providerName: string;
  professionalRating: number | null;
  professionalReviewCount: number;
}) {
  if (state === "upgrade") {
    return (
      <ProfileEmptyState
        icon={Briefcase}
        title="Become a professional or business"
        body="Offer your services and products to the local community."
        action={
          <Button asChild>
            <a href="/offer-a-service">Create professional profile</a>
          </Button>
        }
      />
    );
  }
  if (state === "finish") {
    return (
      <ProfileEmptyState
        icon={Briefcase}
        title="Start offering services"
        body="Finish your professional profile so people nearby can find what you offer."
        action={
          <Button asChild>
            <a href="/offer-a-service">Continue professional profile</a>
          </Button>
        }
      />
    );
  }
  if (state === "empty" || offerings.length === 0) {
    return (
      <ProfileEmptyState
        icon={Briefcase}
        title="No services available"
        body="List a service when you are ready. People nearby will see it on your profile."
        action={
          <Button asChild variant="secondary">
            <a href="/offer-a-service">Offer a service</a>
          </Button>
        }
      />
    );
  }

  const groups = groupOfferings(offerings);
  const headed = groups.used.length > 0 || groups.reviewed.length > 0;
  const sections = [
    { key: "used", title: "Recommended from your activity", items: groups.used },
    { key: "reviewed", title: "Top reviewed", items: groups.reviewed },
    { key: "rest", title: headed ? "Services" : null, items: groups.rest },
  ];
  const profileRating = formatRating(professionalRating, professionalReviewCount);

  return (
    <div className="grid gap-6">
      {profileRating !== "New" ? (
        <p className="m-0 text-sm text-muted-foreground">
          Professional rating <span className="text-accent">★</span> {profileRating} ·{" "}
          {professionalReviewCount} reviews
        </p>
      ) : null}
      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.key} className="grid gap-3">
            {section.title !== null ? (
              <h2 className="text-sm font-semibold">{section.title}</h2>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <ServiceCard
                  key={item.id}
                  href={`/professionals/${item.professionalId}`}
                  title={item.title}
                  description={item.description}
                  categoryLabel={item.categoryLabel}
                  providerName={providerName}
                  priceLabel={formatOfferingPrice(item.displayPriceAmount, item.displayCurrency)}
                  ratingLabel={
                    item.rating !== null && (item.reviewCount ?? 0) > 0
                      ? formatRating(item.rating, item.reviewCount ?? 0)
                      : null
                  }
                  reviewCount={(item.reviewCount ?? 0) > 0 ? item.reviewCount : null}
                  used={item.used}
                  paused={!item.active}
                />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
