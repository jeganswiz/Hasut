import type { HealthData } from "@hasut/types";
import { createAdminApiClient } from "./api";

export async function loadApiHealth(): Promise<HealthData | null> {
  try {
    return await createAdminApiClient().health("ready");
  } catch {
    return null;
  }
}
