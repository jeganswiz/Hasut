"use client";

import { HasutApiError } from "@hasut/api-client";
import type { ProfessionalOnboarding } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWebApiClient } from "../lib/api";
import { flattenCategories } from "../lib/categories";
import { webTokenStorage } from "../lib/token-storage";

type Step = "categories" | "profile" | "service-area" | "review";

export function OfferServiceWizard() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading professional onboarding…");
  const [onboarding, setOnboarding] = useState<ProfessionalOnboarding | null>(null);
  const [step, setStep] = useState<Step>("categories");
  const [selected, setSelected] = useState<string[]>([]);
  const [headline, setHeadline] = useState("");
  const [experienceYears, setExperienceYears] = useState(0);
  const [availability, setAvailability] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(5000);
  const [documentMediaIds, setDocumentMediaIds] = useState("");

  const load = useCallback(async () => {
    const token = await webTokenStorage.getAccessToken();
    if (token === null) {
      window.location.assign("/login");
      return;
    }
    setState("loading");
    try {
      const client = createWebApiClient();
      let data = await client.getProfessionalOnboarding();
      if (data.status === "NOT_STARTED") {
        data = await client.startProfessionalOnboarding();
      }
      setOnboarding(data);
      setSelected(data.professional?.categories.map((item) => item.id) ?? []);
      setHeadline(data.professional?.headline ?? "");
      setExperienceYears(data.professional?.experienceYears ?? 0);
      setAvailability(data.professional?.availability || (data.availabilities[0]?.code ?? ""));
      setSkillsText(data.professional?.skills.map((skill) => skill.label).join(", ") ?? "");
      if (data.professional?.serviceArea) {
        setLatitude(String(data.professional.serviceArea.latitude));
        setLongitude(String(data.professional.serviceArea.longitude));
        setRadiusMeters(data.professional.serviceArea.radiusMeters);
      } else {
        setRadiusMeters(data.serviceAreaRadius.minMeters);
      }
      setStep(data.steps.submitted ? "review" : nextIncompleteStep(data));
      setState("success");
      setMessage(
        data.steps.submitted
          ? "Your professional profile is live. You can pause it or request identity verification."
          : "Offer a service in four steps. Categories come from the live catalog.",
      );
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load onboarding.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flatCategories = useMemo(
    () => (onboarding === null ? [] : flattenCategories(onboarding.categories)),
    [onboarding],
  );

  async function saveCurrent(): Promise<ProfessionalOnboarding | null> {
    if (onboarding === null) {
      return null;
    }
    const client = createWebApiClient();
    if (step === "categories") {
      return client.saveOnboardingCategories({ categoryIds: selected });
    }
    if (step === "profile") {
      return client.saveOnboardingProfile({
        headline,
        experienceYears,
        availability,
        skills: skillsText
          .split(",")
          .map((label) => label.trim())
          .filter((label) => label.length > 0)
          .map((label) => ({ label })),
      });
    }
    if (step === "service-area") {
      return client.saveOnboardingServiceArea({
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters,
      });
    }
    return onboarding;
  }

  async function continueStep(): Promise<void> {
    setState("loading");
    try {
      const saved = await saveCurrent();
      if (saved === null) {
        return;
      }
      setOnboarding(saved);
      setState("success");
      if (step === "categories") {
        setStep("profile");
        setMessage("Add your professional information.");
        return;
      }
      if (step === "profile") {
        setStep("service-area");
        setMessage("Set the area you can serve.");
        return;
      }
      if (step === "service-area") {
        setStep("review");
        setMessage("Review and submit your professional profile.");
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to save this step.");
    }
  }

  async function submit(): Promise<void> {
    setState("loading");
    try {
      const saved = await saveCurrent();
      if (saved === null) {
        return;
      }
      const result = await createWebApiClient().submitProfessionalOnboarding();
      setOnboarding(result);
      setStep("review");
      setState("success");
      setMessage("Submitted. Your professional profile is active.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to submit.");
    }
  }

  async function patchStatus(next: "ACTIVE" | "PAUSED"): Promise<void> {
    setState("loading");
    try {
      await createWebApiClient().patchMyProfessional({ status: next });
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to update status.");
    }
  }

  async function requestVerification(): Promise<void> {
    setState("loading");
    try {
      const ids = documentMediaIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      await createWebApiClient().requestIdentityVerification({ documentMediaIds: ids });
      setState("success");
      setMessage("Identity verification request submitted. Skill verification stays separate.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof HasutApiError ? error.message : "Unable to request verification.",
      );
    }
  }

  function useBrowserLocation(): void {
    if (!navigator.geolocation) {
      setMessage("This browser cannot share a location.");
      setState("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
      },
      () => {
        setState("error");
        setMessage("Location permission is required to set a service area from this device.");
      },
    );
  }

  if (onboarding === null) {
    return (
      <Surface state={state} title="Offer a service">
        <p>{message}</p>
      </Surface>
    );
  }

  return (
    <Surface state={state} title="Offer a service">
      <p>{message}</p>
      <ol className="steps">
        <li className={step === "categories" ? "current" : ""}>Select categories</li>
        <li className={step === "profile" ? "current" : ""}>Professional information</li>
        <li className={step === "service-area" ? "current" : ""}>Service area</li>
        <li className={step === "review" ? "current" : ""}>Submit</li>
      </ol>

      {step === "categories" ? (
        <div className="stack">
          {flatCategories.length === 0 ? (
            <p>No professional categories are available yet. Ask an admin to add them.</p>
          ) : (
            <ul className="category-list">
              {flatCategories.map((node) => (
                <li key={node.id} style={{ marginLeft: node.depth * 16 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(node.id)}
                      onChange={(event) => {
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, node.id]
                            : current.filter((id) => id !== node.id),
                        );
                      }}
                    />
                    {node.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" onClick={() => void continueStep()}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === "profile" ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void continueStep();
          }}
        >
          <label>
            Headline
            <input value={headline} onChange={(event) => setHeadline(event.target.value)} />
          </label>
          <label>
            Years of experience
            <input
              type="number"
              min={0}
              max={70}
              value={experienceYears}
              onChange={(event) => setExperienceYears(Number(event.target.value))}
            />
          </label>
          <label>
            Availability
            <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
              {onboarding.availabilities.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Skills
            <input
              value={skillsText}
              onChange={(event) => setSkillsText(event.target.value)}
              placeholder="Comma-separated skills"
            />
          </label>
          <div className="actions">
            <Button type="button" variant="secondary" onClick={() => setStep("categories")}>
              Back
            </Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      ) : null}

      {step === "service-area" ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void continueStep();
          }}
        >
          <div className="actions">
            <Button type="button" variant="secondary" onClick={useBrowserLocation}>
              Use current location
            </Button>
          </div>
          <label>
            Latitude
            <input value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </label>
          <label>
            Longitude
            <input value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </label>
          <label>
            Radius (meters)
            <input
              type="number"
              min={onboarding.serviceAreaRadius.minMeters}
              max={onboarding.serviceAreaRadius.maxMeters}
              value={radiusMeters}
              onChange={(event) => setRadiusMeters(Number(event.target.value))}
            />
          </label>
          <p className="hint">
            Allowed radius: {onboarding.serviceAreaRadius.minMeters}–
            {onboarding.serviceAreaRadius.maxMeters} meters.
          </p>
          <div className="actions">
            <Button type="button" variant="secondary" onClick={() => setStep("profile")}>
              Back
            </Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      ) : null}

      {step === "review" ? (
        <div className="stack">
          <p>
            Status: <strong>{onboarding.status}</strong>
            {onboarding.professional
              ? ` · ${onboarding.professional.categories.length} categories · ${onboarding.professional.experienceYears} years`
              : ""}
          </p>
          {onboarding.steps.submitted ? (
            <div className="actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void patchStatus(onboarding.status === "PAUSED" ? "ACTIVE" : "PAUSED")
                }
              >
                {onboarding.status === "PAUSED" ? "Resume" : "Pause"}
              </Button>
            </div>
          ) : (
            <div className="actions">
              <Button type="button" variant="secondary" onClick={() => setStep("service-area")}>
                Back
              </Button>
              <Button type="button" onClick={() => void submit()}>
                Submit
              </Button>
            </div>
          )}
          <label>
            Identity verification document media IDs
            <input
              value={documentMediaIds}
              onChange={(event) => setDocumentMediaIds(event.target.value)}
              placeholder="Comma-separated media IDs"
            />
          </label>
          <Button type="button" variant="secondary" onClick={() => void requestVerification()}>
            Request identity verification
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}

function nextIncompleteStep(data: ProfessionalOnboarding): Step {
  if (!data.steps.categories) {
    return "categories";
  }
  if (!data.steps.profile) {
    return "profile";
  }
  if (!data.steps.serviceArea) {
    return "service-area";
  }
  return "review";
}
