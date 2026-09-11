import type { HealthData } from "@hasut/types";
import { resolveBrowserApiBaseUrl } from "@hasut/config";
import { healthDataSchema } from "@hasut/validation";

export async function loadApiHealth(): Promise<HealthData | null> {
  const base = resolveBrowserApiBaseUrl(
    process.env.HASUT_API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL,
    { isBrowser: false },
  );

  try {
    const response = await fetch(`${base}/api/v1/health/ready`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const json: unknown = await response.json();
    if (typeof json !== "object" || json === null || !("data" in json)) {
      return null;
    }
    return healthDataSchema.parse((json as { data: unknown }).data);
  } catch {
    return null;
  }
}
