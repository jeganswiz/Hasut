"use client";

import { HasutApiError } from "@hasut/api-client";
import type { IdentityVerificationRequest } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { createWebApiClient } from "../../lib/api";
import "../social.css";

export default function VerificationPage() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading identity verification…");
  const [request, setRequest] = useState<IdentityVerificationRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await createWebApiClient().getIdentityVerification();
      setRequest(data);
      setState("success");
      setMessage(
        data.status === "VERIFIED"
          ? "Identity verified. This is not a skill verification."
          : `Identity status: ${data.status}. Skill verification is separate and not started here.`,
      );
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "NOT_FOUND") {
        setRequest(null);
        setState("empty");
        setMessage(
          "You have not requested identity verification yet. You can start from Offer a service.",
        );
        return;
      }
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load verification.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <AppNav />
      <h1>Identity verification</h1>
      <p className="lede">
        HASUT reviews identity documents only. A verified identity never means a skill is verified.
      </p>
      <Surface state={state} title="Your request">
        <p>{message}</p>
        {request?.reviewNote ? <p>Reviewer note: {request.reviewNote}</p> : null}
        {request === null ? (
          <Button onClick={() => window.location.assign("/offer-a-service")}>
            Start from Offer a service
          </Button>
        ) : null}
      </Surface>
    </main>
  );
}
