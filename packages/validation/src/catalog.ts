import {
  CATEGORY_APPLIES_TO,
  PROFESSIONAL_STATUSES,
  VERIFICATION_STATUSES,
  type CategoryView,
} from "@hasut/types";
import { z } from "zod";

export const categoryAppliesToSchema = z.enum(CATEGORY_APPLIES_TO);

export const categoryWriteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  parentId: z.string().uuid().nullable().optional(),
  appliesTo: categoryAppliesToSchema.optional().default("ALL"),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10_000).optional().default(100),
});

export const categoryPatchSchema = categoryWriteSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const categoryViewSchema: z.ZodType<CategoryView> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    parentId: z.string().nullable(),
    slug: z.string().min(1),
    name: z.string().min(1),
    appliesTo: categoryAppliesToSchema,
    isActive: z.boolean(),
    sortOrder: z.number(),
    children: z.array(categoryViewSchema),
  }),
);

export const categoryListSchema = z.array(categoryViewSchema);

export const availabilityOptionSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
});

export const onboardingCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1).max(12),
});

export const onboardingSkillSchema = z.object({
  label: z.string().trim().min(1).max(80),
  categoryId: z.string().uuid().nullable().optional(),
});

export const onboardingProfileSchema = z.object({
  headline: z.string().trim().max(120).optional().default(""),
  experienceYears: z.number().int().min(0).max(70),
  availability: z.string().min(1).max(32),
  skills: z.array(onboardingSkillSchema).max(20).optional().default([]),
});

export const onboardingServiceAreaSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  radiusMeters: z.number().int().positive(),
});

export const professionalStatusPatchSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"] as const),
});

export const identityVerificationWriteSchema = z.object({
  documentMediaIds: z.array(z.string().uuid()).min(1).max(8),
});

export const publicServiceAreaSchema = z.object({
  label: z.string().min(1),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  countryCode: z.string().nullable(),
  radiusMeters: z.number().int().positive(),
});

export const ownerServiceAreaSchema = publicServiceAreaSchema.extend({
  latitude: z.number(),
  longitude: z.number(),
});

export const professionalSkillViewSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  categoryId: z.string().nullable(),
});

export const publicProfessionalSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  headline: z.string(),
  experienceYears: z.number().int().nonnegative(),
  availability: z.string().min(1),
  status: z.enum(PROFESSIONAL_STATUSES),
  identityVerificationStatus: z.enum(VERIFICATION_STATUSES),
  skillVerificationStatus: z.enum(VERIFICATION_STATUSES),
  categories: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
  skills: z.array(professionalSkillViewSchema),
  serviceArea: publicServiceAreaSchema.nullable(),
});

export const ownerProfessionalSchema = publicProfessionalSchema.extend({
  serviceArea: ownerServiceAreaSchema.nullable(),
});

export const professionalOnboardingSchema = z.object({
  status: z.enum(["NOT_STARTED", "DRAFT", "ACTIVE", "PAUSED"]),
  steps: z.object({
    categories: z.boolean(),
    profile: z.boolean(),
    serviceArea: z.boolean(),
    submitted: z.boolean(),
  }),
  professional: ownerProfessionalSchema.nullable(),
  categories: categoryListSchema,
  availabilities: z.array(availabilityOptionSchema),
  serviceAreaRadius: z.object({
    minMeters: z.number().int().positive(),
    maxMeters: z.number().int().positive(),
  }),
});

export const identityVerificationRequestSchema = z.object({
  id: z.string().min(1),
  type: z.literal("IDENTITY"),
  status: z.enum(["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "EXPIRED"]),
  documentMediaIds: z.array(z.string()),
  reviewNote: z.string().nullable(),
  createdAt: z.string().min(1),
  decidedAt: z.string().nullable(),
});

export const serviceOfferingWriteSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().default(""),
  displayPriceAmount: z.number().nonnegative().nullable().optional(),
  displayCurrency: z.string().trim().min(3).max(3).nullable().optional(),
});

export const serviceOfferingViewSchema = z.object({
  id: z.string().min(1),
  professionalId: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  displayPriceAmount: z.number().nullable(),
  displayCurrency: z.string().nullable(),
  isActive: z.boolean(),
});

export const serviceOfferingListSchema = z.array(serviceOfferingViewSchema);

export const reviewWriteSchema = z.object({
  subjectType: z.enum(["PROFESSIONAL", "BUSINESS"]),
  subjectId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1_000).optional().default(""),
});

export const reviewViewSchema = z.object({
  id: z.string().min(1),
  subjectType: z.enum(["PROFESSIONAL", "BUSINESS"]),
  subjectId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string(),
  author: z.object({
    id: z.string().min(1),
    displayName: z.string(),
    photoUrl: z.string().nullable(),
  }),
  createdAt: z.string(),
});

export const reviewListSchema = z.array(reviewViewSchema);

export const reviewAggregateViewSchema = z.object({
  avgRating: z.number(),
  count: z.number().int().nonnegative(),
});
