"use client";

import { HasutApiError } from "@hasut/api-client";
import type { PublicProfessional } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../../../lib/api";

export default function ProfessionalProfilePage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<SurfaceState>("loading");
  const [profile, setProfile] = useState<PublicProfessional | null>(null);
  const [message, setMessage] = useState("Loading professional…");

  useEffect(() => {
    void createWebApiClient()
      .getProfessional(params.id)
      .then((data) => {
        setProfile(data);
        setState("success");
        setMessage(data.headline || "Professional profile");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(
          error instanceof HasutApiError ? error.message : "Unable to load this professional.",
        );
      });
  }, [params.id]);

  return (
    <main>
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
    </main>
  );
}
