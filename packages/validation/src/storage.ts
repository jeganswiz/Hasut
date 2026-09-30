import {
  STORAGE_BACKENDS,
  STORAGE_MIGRATION_ITEM_STATUSES,
  STORAGE_MIGRATION_STATUSES,
} from "@hasut/types";
import { z } from "zod";

const httpUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value.length === 0 || /^https?:\/\//i.test(value), {
    message: "Use an http or https URL",
  });

export const storageSwitchSchema = z.object({
  provider: z.enum(STORAGE_BACKENDS),
  endpoint: z.string().trim().max(300).optional().default(""),
  region: z.string().trim().max(64).optional().default(""),
  bucket: z.string().trim().max(128).optional().default(""),
  accessKey: z.string().max(256).optional().default(""),
  secretKey: z.string().max(256).optional().default(""),
  forcePathStyle: z.boolean().optional(),
  publicBaseUrl: httpUrl.optional().default(""),
  localRoot: z.string().trim().max(300).optional().default(""),
  migrate: z.boolean().optional(),
});

const storageProviderOptionSchema = z.object({
  id: z.enum(STORAGE_BACKENDS),
  label: z.string(),
  summary: z.string(),
  needsCredentials: z.boolean(),
  defaultRegion: z.string(),
  defaultForcePathStyle: z.boolean(),
  endpointHint: z.string(),
});

const storageProfileViewSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(STORAGE_BACKENDS),
  label: z.string(),
  endpoint: z.string(),
  region: z.string(),
  bucket: z.string(),
  forcePathStyle: z.boolean(),
  publicBaseUrl: z.string(),
  localRoot: z.string(),
  accessKeyHint: z.string().nullable(),
  secretConfigured: z.boolean(),
  isActive: z.boolean(),
  readyAssetCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

const storageMigrationItemViewSchema = z.object({
  id: z.string().uuid(),
  objectKey: z.string(),
  status: z.enum(STORAGE_MIGRATION_ITEM_STATUSES),
  byteSize: z.number().int().nonnegative(),
  errorMessage: z.string(),
  updatedAt: z.string(),
});

export const storageMigrationViewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STORAGE_MIGRATION_STATUSES),
  fromLabel: z.string(),
  toLabel: z.string(),
  fromProvider: z.enum(STORAGE_BACKENDS),
  toProvider: z.enum(STORAGE_BACKENDS),
  totalCount: z.number().int().nonnegative(),
  copiedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  errorMessage: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  items: z.array(storageMigrationItemViewSchema),
});

export const storageOverviewSchema = z.object({
  active: storageProfileViewSchema,
  profiles: z.array(storageProfileViewSchema),
  providers: z.array(storageProviderOptionSchema),
  migration: storageMigrationViewSchema.nullable(),
});

export const storageSwitchResultSchema = z.object({
  outcome: z.enum(["switched", "confirmation_required", "migration_started"]),
  overview: storageOverviewSchema,
  pendingAssetCount: z.number().int().nonnegative(),
  pendingBytes: z.number().int().nonnegative(),
});
