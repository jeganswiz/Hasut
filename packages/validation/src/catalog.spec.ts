import {
  categoryWriteSchema,
  onboardingProfileSchema,
  professionalOnboardingSchema,
} from "./catalog";

describe("catalog validation", () => {
  it("accepts a category create payload", () => {
    const parsed = categoryWriteSchema.parse({ name: "Home services", parentId: null });
    expect(parsed.name).toBe("Home services");
    expect(parsed.appliesTo).toBe("ALL");
  });

  it("accepts onboarding profile and onboarding state from the API", () => {
    const profile = onboardingProfileSchema.parse({
      experienceYears: 4,
      availability: "AVAILABLE",
      skills: [{ label: "Leak repair" }],
    });
    expect(profile.headline).toBe("");

    const onboarding = professionalOnboardingSchema.parse({
      status: "DRAFT",
      steps: { categories: true, profile: true, serviceArea: false, submitted: false },
      professional: null,
      categories: [],
      availabilities: [{ code: "AVAILABLE", label: "Available" }],
      serviceAreaRadius: { minMeters: 500, maxMeters: 50_000 },
    });
    expect(onboarding.categories).toEqual([]);
  });
});
