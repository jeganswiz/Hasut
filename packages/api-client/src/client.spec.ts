import { fail, ok } from "@hasut/types";
import { HasutApiClient, HasutApiError, apiErrorMessage, isHasutApiError } from "./client";

describe("HasutApiClient", () => {
  it("parses a healthy ready payload", async () => {
    const payload = ok(
      {
        status: "ok",
        scope: "ready",
        service: "hasut-api",
        version: "0.0.0",
        uptimeSeconds: 2,
        checks: { postgres: "up", postgis: "up", redis: "up" },
      },
      "req-health",
    );

    const client = new HasutApiClient({
      baseUrl: "http://localhost:3001",
      fetchImpl: async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });

    const health = await client.health("ready");
    expect(health.status).toBe("ok");
    expect(health.checks?.postgres).toBe("up");
  });

  it("throws HasutApiError for a structured failure", async () => {
    const client = new HasutApiClient({
      baseUrl: "http://localhost:3001",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "SERVICE_UNAVAILABLE", message: "Redis down" },
            meta: { requestId: "req-down" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
    });

    await expect(client.health("ready")).rejects.toBeInstanceOf(HasutApiError);
  });

  it("posts an OTP request", async () => {
    const payload = ok(
      {
        challengeId: "challenge-1",
        expiresAt: "2026-01-01T00:05:00.000Z",
        resendAvailableAt: "2026-01-01T00:01:00.000Z",
      },
      "req-otp",
    );
    const client = new HasutApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (url, init) => {
        expect(String(url)).toBe("http://127.0.0.1:3001/api/v1/auth/otp/request");
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const receipt = await client.requestOtp({ phone: "+919876543210" });
    expect(receipt.challengeId).toBe("challenge-1");
  });

  it("parses a public member profile without exact coordinates", async () => {
    const payload = ok(
      {
        id: "member-1",
        displayName: "Jegan",
        bio: "Builder",
        photoUrl: null,
        currentMode: { code: "AVAILABLE", label: "Available" },
        statusText: "Creating",
        approximateLocation: {
          label: "Bengaluru, Karnataka, India",
          city: "Bengaluru",
          region: "Karnataka",
          country: "India",
          countryCode: "IN",
        },
      },
      "req-profile",
    );
    const client = new HasutApiClient({
      baseUrl: "http://localhost:3001",
      fetchImpl: async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    const profile = await client.getMember("member-1");
    expect(profile.approximateLocation?.city).toBe("Bengaluru");
    expect(profile).not.toHaveProperty("exact");
  });

  it("loads categories from the API without embedding names in the client", async () => {
    const payload = ok(
      [
        {
          id: "cat-1",
          parentId: null,
          slug: "home-services",
          name: "Home services",
          appliesTo: "PROFESSIONAL",
          isActive: true,
          sortOrder: 10,
          children: [
            {
              id: "cat-2",
              parentId: "cat-1",
              slug: "plumbing",
              name: "Plumbing",
              appliesTo: "PROFESSIONAL",
              isActive: true,
              sortOrder: 10,
              children: [],
            },
          ],
        },
      ],
      "req-cats",
    );
    const client = new HasutApiClient({
      baseUrl: "http://localhost:3001",
      fetchImpl: async (url) => {
        expect(String(url)).toContain("/api/v1/categories?appliesTo=PROFESSIONAL");
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const tree = await client.listCategories("PROFESSIONAL");
    expect(tree[0]?.children[0]?.name).toBe("Plumbing");
  });

  it("parses a public professional without exact service-area coordinates", async () => {
    const payload = ok(
      {
        id: "pro-1",
        memberId: "member-1",
        headline: "Nearby help",
        experienceYears: 4,
        availability: "AVAILABLE",
        status: "ACTIVE",
        identityVerificationStatus: "NOT_STARTED",
        skillVerificationStatus: "NOT_STARTED",
        categories: [{ id: "cat-1", name: "Home services", slug: "home-services" }],
        skills: [{ id: "skill-1", label: "Repairs", categoryId: "cat-1" }],
        serviceArea: {
          label: "Bengaluru, Karnataka, India",
          city: "Bengaluru",
          region: "Karnataka",
          country: "India",
          countryCode: "IN",
          radiusMeters: 5000,
        },
      },
      "req-pro",
    );
    const client = new HasutApiClient({
      baseUrl: "http://localhost:3001",
      fetchImpl: async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    const professional = await client.getProfessional("pro-1");
    expect(professional.serviceArea?.city).toBe("Bengaluru");
    expect(professional.serviceArea).not.toHaveProperty("latitude");
  });

  it("parses nearby discovery results with snapped pins", async () => {
    const payload = ok(
      {
        originLabel: "Bengaluru",
        radiusMeters: 5000,
        items: [
          {
            id: "pro-1",
            kind: "PROFESSIONAL",
            title: "AC Service",
            subtitle: "Esther",
            photoUrl: null,
            categoryLabel: "Home services",
            rating: 4.3,
            reviewCount: 12,
            distanceBucket: "200m",
            verified: true,
            available: true,
            href: "/professionals/pro-1",
          },
        ],
        markers: [
          {
            id: "pro-1",
            kind: "PROFESSIONAL",
            label: "AC Service",
            rating: 4.3,
            selected: false,
            pinLat: 12.97,
            pinLng: 77.59,
          },
        ],
        clusters: [],
      },
      "req-nearby",
    );
    const client = new HasutApiClient({
      baseUrl: "http://localhost:3001",
      fetchImpl: async (url) => {
        expect(String(url)).toContain("/api/v1/discovery/nearby");
        expect(String(url)).toContain("verified=true");
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const result = await client.nearby({
      latitude: 12.97,
      longitude: 77.59,
      verified: true,
    });
    expect(result.items[0]?.distanceBucket).toBe("200m");
    expect(result.markers[0]).not.toHaveProperty("latitude");
  });

  it("recognizes HasutApiError across duplicate class copies", () => {
    const foreign = new Error("Unable to reach the HASUT API");
    foreign.name = "HasutApiError";
    (foreign as Error & { envelope: unknown }).envelope = fail(
      "SERVICE_UNAVAILABLE",
      "Unable to reach the HASUT API",
      "req-copy",
    );
    expect(isHasutApiError(foreign)).toBe(true);
    expect(apiErrorMessage(foreign, "fallback")).toBe("Unable to reach the HASUT API");
    expect(apiErrorMessage(new Error("boom"), "Start the API")).toBe("Start the API");
  });
});
