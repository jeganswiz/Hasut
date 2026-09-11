import { parseApiEnv, type ApiEnv } from "@hasut/config";

export function validateEnv(config: Record<string, unknown>): ApiEnv {
  return parseApiEnv(config);
}

export type { ApiEnv };
