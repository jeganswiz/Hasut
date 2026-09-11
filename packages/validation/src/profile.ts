import { z } from "zod";

export const displayNameSchema = z.string().trim().min(1).max(80);
export const bioSchema = z.string().max(500);
export const statusTextSchema = z.string().max(80);
export const currentModeCodeSchema = z.string().min(1).max(64);

export const profileWriteSchema = z.object({
  displayName: displayNameSchema,
  bio: bioSchema.optional().default(""),
  photoMediaId: z.string().uuid().nullable().optional(),
  currentModeCode: currentModeCodeSchema.nullable().optional(),
  statusText: statusTextSchema.optional().default(""),
  isDiscoverable: z.boolean().optional().default(true),
});

export const profilePatchSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    bio: bioSchema.optional(),
    photoMediaId: z.string().uuid().nullable().optional(),
    currentModeCode: currentModeCodeSchema.nullable().optional(),
    statusText: statusTextSchema.optional(),
    isDiscoverable: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const modeWriteSchema = z.object({
  modeCode: currentModeCodeSchema,
  statusText: statusTextSchema.optional(),
});

export const currentModeViewSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
});

export const approximateLocationSchema = z.object({
  label: z.string().min(1),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  countryCode: z.string().nullable(),
});

export const profileCompletionSchema = z.object({
  percentage: z.number().int().min(0).max(100),
  fields: z.object({
    displayName: z.boolean(),
    bio: z.boolean(),
    photo: z.boolean(),
    currentMode: z.boolean(),
    statusText: z.boolean(),
    location: z.boolean(),
  }),
});

export const publicMemberProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  bio: z.string(),
  photoUrl: z.string().nullable(),
  currentMode: currentModeViewSchema.nullable(),
  statusText: z.string(),
  approximateLocation: approximateLocationSchema.nullable(),
});

export const ownerMemberProfileSchema = publicMemberProfileSchema.extend({
  photoMediaId: z.string().nullable(),
  isDiscoverable: z.boolean(),
  completion: profileCompletionSchema,
});

export const currentModeListSchema = z.array(currentModeViewSchema);
