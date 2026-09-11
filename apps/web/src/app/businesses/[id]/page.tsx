"use client";

import { HasutApiError } from "@hasut/api-client";
import type { PublicBusiness } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../../../lib/api";

export default function BusinessProfilePage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<SurfaceState>("loading");
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [message, setMessage] = useState("Loading business…");

  useEffect(() => {
    void createWebApiClient()
      .getBusiness(params.id)
      .then((data) => {
        setBusiness(data);
        setState("success");
        setMessage(data.description || "Business profile");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(
          error instanceof HasutApiError ? error.message : "Unable to load this business.",
        );
      });
  }, [params.id]);

  return (
    <main>
      <p>
        <a href="/">Back to map</a>
      </p>
      <h1>{business?.name ?? "Business"}</h1>
      <Surface state={state} title="Business">
        <p>{message}</p>
        {business?.approximateLocation ? <p>{business.approximateLocation.label}</p> : null}
      </Surface>
    </main>
  );
}
