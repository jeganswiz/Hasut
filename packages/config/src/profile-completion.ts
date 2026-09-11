export const PROFILE_COMPLETION_FIELDS = [
  "displayName",
  "bio",
  "photo",
  "currentMode",
  "statusText",
  "location",
] as const;

export type ProfileCompletionField = (typeof PROFILE_COMPLETION_FIELDS)[number];

export const CURRENT_MODE_SEEDS = [
  { code: "AVAILABLE", label: "Available", sortOrder: 10 },
  { code: "LOOKING_FOR_WORK", label: "Looking for work", sortOrder: 20 },
  { code: "LOOKING_FOR_BUSINESS", label: "Looking for business", sortOrder: 30 },
  { code: "LOOKING_FOR_COLLABORATION", label: "Looking for collaboration", sortOrder: 40 },
  { code: "PROMOTING_SERVICE", label: "Promoting a service", sortOrder: 50 },
  { code: "CREATING", label: "Creating", sortOrder: 60 },
  { code: "WORKING", label: "Working", sortOrder: 70 },
  { code: "AWAY", label: "Away", sortOrder: 80 },
] as const;
