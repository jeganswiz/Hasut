import { HasutApiError } from "@hasut/api-client";
import type { OwnerMemberProfile } from "@hasut/types";
import { loadNavProfile } from "./session-profile";

function rejected(): never {
  throw new HasutApiError({
    success: false,
    error: { code: "UNAUTHENTICATED", message: "Sign in required" },
    meta: { requestId: "req-1" },
  });
}

const PROFILE = {
  id: "member-1",
  displayName: "Asha Raman",
  bio: "",
  photoUrl: null,
  currentMode: null,
  statusText: "",
  approximateLocation: null,
  photoMediaId: null,
  isDiscoverable: true,
  completion: {
    percentage: 40,
    fields: {
      displayName: true,
      bio: false,
      photo: false,
      currentMode: false,
      statusText: false,
      location: false,
    },
  },
} satisfies OwnerMemberProfile;

describe("loadNavProfile", () => {
  it("returns null when there is no access token", async () => {
    const profile = await loadNavProfile({
      getAccessToken: async () => null,
      getRefreshToken: async () => "refresh",
      readProfile: async () => PROFILE,
      refresh: async () => ({ accessToken: "next", refreshToken: "refresh" }),
      save: async () => undefined,
    });
    expect(profile).toBeNull();
  });

  it("returns the profile when the access token is still valid", async () => {
    const profile = await loadNavProfile({
      getAccessToken: async () => "access",
      getRefreshToken: async () => null,
      readProfile: async () => PROFILE,
      refresh: async () => ({ accessToken: "next", refreshToken: "refresh" }),
      save: async () => undefined,
    });
    expect(profile?.displayName).toBe("Asha Raman");
  });

  it("refreshes once when the access token is rejected", async () => {
    const saved: string[] = [];
    let reads = 0;
    const profile = await loadNavProfile({
      getAccessToken: async () => "stale",
      getRefreshToken: async () => "refresh-1",
      readProfile: async () => {
        reads += 1;
        if (reads === 1) {
          rejected();
        }
        return PROFILE;
      },
      refresh: async () => ({ accessToken: "fresh", refreshToken: "refresh-2" }),
      save: async (tokens) => {
        saved.push(tokens.accessToken);
      },
    });
    expect(profile?.displayName).toBe("Asha Raman");
    expect(saved).toEqual(["fresh"]);
    expect(reads).toBe(2);
  });
});
