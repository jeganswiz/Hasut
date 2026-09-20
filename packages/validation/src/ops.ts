import {
  REPORT_MODERATION_ACTIONS,
  VERIFICATION_DECISIONS,
  type AdminReportView,
  type AdminVerificationRequest,
  type NotificationTemplateView,
  type OpsSummaryView,
  type StaffMemberView,
} from "@hasut/types";
import { z } from "zod";
import { identityVerificationRequestSchema } from "./catalog";
import { publicThemeConfigSchema } from "./config";
import { memberPreviewSchema, reportViewSchema } from "./social";

export const verificationDecideSchema = z.object({
  decision: z.enum(VERIFICATION_DECISIONS),
  reviewNote: z.string().trim().max(1_000).optional().default(""),
});

export const adminVerificationRequestSchema: z.ZodType<AdminVerificationRequest> =
  identityVerificationRequestSchema.extend({
    member: memberPreviewSchema,
    reviewNote: z.string().nullable(),
  });

export const adminVerificationListSchema = z.array(adminVerificationRequestSchema);

export const reportModerateSchema = z.object({
  action: z.enum(REPORT_MODERATION_ACTIONS),
});

export const adminReportViewSchema: z.ZodType<AdminReportView> = reportViewSchema.extend({
  reporter: memberPreviewSchema,
  hidden: z.boolean(),
});

export const adminReportListSchema = z.array(adminReportViewSchema);

export const notificationTemplateViewSchema: z.ZodType<NotificationTemplateView> = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  channel: z.literal("IN_APP"),
  titleTemplate: z.string().min(1).max(160),
  bodyTemplate: z.string().min(1).max(500),
  isActive: z.boolean(),
});

export const notificationTemplateListSchema = z.array(notificationTemplateViewSchema);

export const notificationTemplateWriteSchema = z.object({
  titleTemplate: z.string().trim().min(1).max(160),
  bodyTemplate: z.string().trim().min(1).max(500),
  isActive: z.boolean().optional(),
});

export const opsSummaryViewSchema: z.ZodType<OpsSummaryView> = z.object({
  pendingVerifications: z.number().int().nonnegative(),
  openReports: z.number().int().nonnegative(),
  openTickets: z.number().int().nonnegative(),
  suspendedMembers: z.number().int().nonnegative(),
});

export const staffMemberViewSchema: z.ZodType<StaffMemberView> = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  roles: z.array(z.string()),
});

export const staffMemberListSchema = z.array(staffMemberViewSchema);

export const adminMemberViewSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  status: z.string(),
  roles: z.array(z.string()),
  createdAt: z.string(),
});

export const adminMemberListSchema = z.array(adminMemberViewSchema);

export const adminMemberDetailSchema = adminMemberViewSchema.extend({
  sessionCount: z.number().int().nonnegative(),
});

export const auditLogViewSchema = z.object({
  id: z.string().min(1),
  actorId: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  requestId: z.string(),
  createdAt: z.string(),
});

export const auditLogListSchema = z.array(auditLogViewSchema);

export const featureFlagAdminViewSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  description: z.string(),
});

export const featureFlagAdminListSchema = z.array(featureFlagAdminViewSchema);

export const themeEditorViewSchema = z.object({
  version: z.number(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  tokens: publicThemeConfigSchema.shape.tokens,
  logoUrl: z.string().nullable(),
  contrastWarnings: z.array(z.string()),
});

export const memberRolesPatchSchema = z.object({
  roles: z.array(z.enum(["MEMBER", "ADMIN", "SUPPORT_AGENT", "MODERATOR"])).min(1),
});

export const adminProfessionalViewSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  displayName: z.string(),
  headline: z.string(),
  status: z.string(),
  identityVerificationStatus: z.string(),
});

export const adminProfessionalListSchema = z.array(adminProfessionalViewSchema);

export const adminBusinessViewSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: z.string(),
  ownerDisplayName: z.string(),
});

export const adminBusinessListSchema = z.array(adminBusinessViewSchema);
