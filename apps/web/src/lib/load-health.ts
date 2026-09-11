import type { HealthData } from "@hasut/types";
import { createWebApiClient } from "./api";

export async function loadApiHealth(): Promise<HealthData | null> {
  try {
    return await createWebApiClient().health("ready");
  } catch {
    return null;
  }
}
