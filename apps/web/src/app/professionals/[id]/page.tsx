"use client";

import { HasutApiError } from "@hasut/api-client";
import type { PublicProfessional, ReviewView, ServiceOfferingView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "../../../components/app-nav";
import { createWebApiClient } from "../../../lib/api";

export default function ProfessionalProfilePage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<SurfaceState>("loading");
  const [profile, setProfile] = useState<PublicProfessional | null>(null);
  const [message, setMessage] = useState("Loading professional…");
  const [offerings, setOfferings] = useState<ServiceOfferingView[]>([]);
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [rating, setRating] = useState("5");

  useEffect(() => {
    void (async () => {
      try {
        const client = createWebApiClient();
        const [data, listed, written] = await Promise.all([
          client.getProfessional(params.id),
          client.listProfessionalServices(params.id),
          client.listReviews("PROFESSIONAL", params.id),
        ]);
        setProfile(data);
        setOfferings(listed);
        setReviews(written);
        setState("success");
        setMessage(data.headline || "Professional profile");
      } catch (error) {
        setState("error");
        setMessage(
          error instanceof HasutApiError ? error.message : "Unable to load this professional.",
        );
      }
    })();
  }, [params.id]);

  return (
    <main>
      <AppNav />
      <p>
        <a href="/">Back to map</a>
      </p>
      <h1>{profile?.headline || "Professional"}</h1>
      <Surface state={state} title="Professional">
        <p>{message}</p>
        {profile ? (
          <p>
            {profile.experienceYears} years · {profile.availability}
            {profile.identityVerificationStatus === "VERIFIED" ? " · Identity verified" : ""}
          </p>
        ) : null}
        {profile?.serviceArea ? <p>{profile.serviceArea.label}</p> : null}
      </Surface>
      <Surface state={offerings.length === 0 ? "empty" : "success"} title="Offerings">
        {offerings.length === 0 ? <p>No service offerings listed.</p> : null}
        {offerings.map((item) => (
          <p key={item.id}>
            {item.title}
            {item.description ? ` — ${item.description}` : ""}
          </p>
        ))}
      </Surface>
      <Surface state={reviews.length === 0 ? "empty" : "success"} title="Reviews">
        {reviews.map((item) => (
          <p key={item.id}>
            {item.author.displayName}: {item.rating}/5 {item.body}
          </p>
        ))}
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void createWebApiClient()
              .createReview({
                subjectType: "PROFESSIONAL",
                subjectId: params.id,
                rating: Number(rating),
                body: String(data.get("body") ?? ""),
              })
              .then((created) => {
                setReviews((current) => [created, ...current]);
                setMessage("Review saved. Only accepted connections can review.");
              })
              .catch((error: unknown) => {
                setMessage(error instanceof HasutApiError ? error.message : "Unable to review.");
              });
          }}
        >
          <label>
            Rating
            <select value={rating} onChange={(event) => setRating(event.target.value)}>
              {["1", "2", "3", "4", "5"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Review
            <textarea name="body" />
          </label>
          <Button type="submit">Write review</Button>
        </form>
      </Surface>
    </main>
  );
}
