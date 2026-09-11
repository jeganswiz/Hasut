export const CATEGORY_APPLIES_TO = ["PROFESSIONAL", "BUSINESS", "SERVICE", "ALL"] as const;
export type CategoryAppliesTo = (typeof CATEGORY_APPLIES_TO)[number];

export const PROFESSIONAL_STATUSES = ["DRAFT", "ACTIVE", "PAUSED"] as const;
export type ProfessionalStatus = (typeof PROFESSIONAL_STATUSES)[number];

export const ONBOARDING_STATUSES = ["NOT_STARTED", "DRAFT", "ACTIVE", "PAUSED"] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const VERIFICATION_TYPES = ["IDENTITY", "BUSINESS", "SKILL"] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "NOT_STARTED",
  "PENDING",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface CategoryView {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  appliesTo: CategoryAppliesTo;
  isActive: boolean;
  sortOrder: number;
  children: CategoryView[];
}

export interface AvailabilityOption {
  code: string;
  label: string;
}

export interface ProfessionalSkillView {
  id: string;
  label: string;
  categoryId: string | null;
}

export interface PublicServiceArea {
  label: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  radiusMeters: number;
}

export interface OwnerServiceArea extends PublicServiceArea {
  latitude: number;
  longitude: number;
}

export interface PublicProfessional {
  id: string;
  memberId: string;
  headline: string;
  experienceYears: number;
  availability: string;
  status: ProfessionalStatus;
  identityVerificationStatus: VerificationStatus;
  skillVerificationStatus: VerificationStatus;
  categories: Array<{ id: string; name: string; slug: string }>;
  skills: ProfessionalSkillView[];
  serviceArea: PublicServiceArea | null;
}

export interface OwnerProfessional extends PublicProfessional {
  serviceArea: OwnerServiceArea | null;
}

export interface OnboardingSteps {
  categories: boolean;
  profile: boolean;
  serviceArea: boolean;
  submitted: boolean;
}

export interface ProfessionalOnboarding {
  status: OnboardingStatus;
  steps: OnboardingSteps;
  professional: OwnerProfessional | null;
  categories: CategoryView[];
  availabilities: AvailabilityOption[];
  serviceAreaRadius: {
    minMeters: number;
    maxMeters: number;
  };
}

export interface IdentityVerificationRequest {
  id: string;
  type: "IDENTITY";
  status: Exclude<VerificationStatus, "NOT_STARTED">;
  documentMediaIds: string[];
  createdAt: string;
  decidedAt: string | null;
}
