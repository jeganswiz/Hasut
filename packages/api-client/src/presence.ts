import { discoveryPresenceUpdatedSchema } from "@hasut/validation";
import type { DiscoveryPresenceUpdated } from "@hasut/types";

export function parseDiscoveryPresenceUpdated(value: unknown): DiscoveryPresenceUpdated | null {
  const parsed = discoveryPresenceUpdatedSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
