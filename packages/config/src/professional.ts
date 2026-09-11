export interface AvailabilityOption {
  code: string;
  label: string;
}

export const PROFESSIONAL_AVAILABILITY_CONFIG_KEY = "professional.availability";

/** Seed / fallback catalog owned by configuration, not professional use-cases. */
export const PROFESSIONAL_AVAILABILITY_DEFAULTS: AvailabilityOption[] = [
  { code: "AVAILABLE", label: "Available" },
  { code: "BUSY", label: "Busy" },
  { code: "UNAVAILABLE", label: "Unavailable" },
];

export function isAvailabilityOptions(value: unknown): value is AvailabilityOption[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as AvailabilityOption).code === "string" &&
      typeof (item as AvailabilityOption).label === "string",
  );
}
