import { DISCOVERY_KINDS } from "@hasut/types";
import { z } from "zod";

export const discoveryKindSchema = z.enum(DISCOVERY_KINDS);

export const discoveryQuerySchema = z.object({
  latitude: z.coerce.number().gte(-90).lte(90).optional(),
  longitude: z.coerce.number().gte(-180).lte(180).optional(),
  radiusMeters: z.coerce.number().int().positive().optional(),
  kinds: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value.length === 0
        ? undefined
        : value
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0),
    )
    .pipe(z.array(discoveryKindSchema).optional()),
  categoryId: z.string().uuid().optional(),
  verified: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  available: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  q: z.string().trim().max(80).optional(),
});

export const discoveryPinSchema = z.object({
  pinLat: z.number(),
  pinLng: z.number(),
});

export const discoveryCardSchema = z.object({
  id: z.string().min(1),
  kind: discoveryKindSchema,
  title: z.string(),
  subtitle: z.string(),
  photoUrl: z.string().nullable(),
  categoryLabel: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
  distanceBucket: z.string().min(1),
  verified: z.boolean(),
  available: z.boolean(),
  href: z.string().min(1),
});

export const discoveryMarkerSchema = discoveryPinSchema.extend({
  id: z.string().min(1),
  kind: discoveryKindSchema,
  label: z.string(),
  rating: z.number().nullable(),
  selected: z.boolean(),
});

export const discoveryClusterSchema = discoveryPinSchema.extend({
  id: z.string().min(1),
  count: z.number().int().positive(),
  kinds: z.array(discoveryKindSchema),
});

export const discoveryResultSchema = z.object({
  originLabel: z.string().nullable(),
  radiusMeters: z.number().int().positive(),
  items: z.array(discoveryCardSchema),
  markers: z.array(discoveryMarkerSchema),
  clusters: z.array(discoveryClusterSchema),
});

export const discoveryPreviewSchema = z.object({
  id: z.string().min(1),
  kind: discoveryKindSchema,
  title: z.string(),
  subtitle: z.string(),
  bio: z.string(),
  photoUrl: z.string().nullable(),
  categoryLabels: z.array(z.string()),
  rating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
  distanceBucket: z.string().min(1),
  verified: z.boolean(),
  available: z.boolean(),
  approximateLocation: z
    .object({
      label: z.string(),
      city: z.string().nullable(),
      region: z.string().nullable(),
      country: z.string().nullable(),
      countryCode: z.string().nullable(),
    })
    .nullable(),
  href: z.string().min(1),
});

export const discoveryPolicyViewSchema = z.object({
  defaultRadiusMeters: z.number().int().positive(),
  minRadiusMeters: z.number().int().positive(),
  maxRadiusMeters: z.number().int().positive(),
  radiusOptionsMeters: z.array(z.number().int().positive()),
  clusterCellMeters: z.number().int().positive(),
  includeMembers: z.boolean(),
  availableCodes: z.array(z.string()),
  availableModeCodes: z.array(z.string()),
  mapTileUrl: z.string().min(1),
  demoLatitude: z.number(),
  demoLongitude: z.number(),
});

export const discoveryRankingWeightsViewSchema = z.object({
  distance: z.number(),
  categoryRelevance: z.number(),
  availability: z.number(),
  verification: z.number(),
  rating: z.number(),
  activity: z.number(),
});

export const discoveryPolicyPatchSchema = z
  .object({
    defaultRadiusMeters: z.number().int().positive().optional(),
    minRadiusMeters: z.number().int().positive().optional(),
    maxRadiusMeters: z.number().int().positive().optional(),
    radiusOptionsMeters: z.array(z.number().int().positive()).min(1).optional(),
    clusterCellMeters: z.number().int().positive().optional(),
    includeMembers: z.boolean().optional(),
    availableCodes: z.array(z.string().min(1)).min(1).optional(),
    availableModeCodes: z.array(z.string().min(1)).min(1).optional(),
    mapTileUrl: z.string().url().optional(),
    distanceBucketStepsMeters: z.array(z.number().int().positive()).min(1).optional(),
    activityHalfLifeHours: z.number().positive().optional(),
    professionalMatch: z.enum(["service_area", "presence", "either"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const discoveryRankingPatchSchema = z.object({
  distance: z.number().nonnegative(),
  categoryRelevance: z.number().nonnegative(),
  availability: z.number().nonnegative(),
  verification: z.number().nonnegative(),
  rating: z.number().nonnegative(),
  activity: z.number().nonnegative(),
});

export const businessWriteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().default(""),
  categoryIds: z.array(z.string().uuid()).min(1).max(12),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export const publicBusinessSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  verificationStatus: z.string().min(1),
  categories: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
  approximateLocation: z
    .object({
      label: z.string(),
      city: z.string().nullable(),
      region: z.string().nullable(),
      country: z.string().nullable(),
      countryCode: z.string().nullable(),
    })
    .nullable(),
});
