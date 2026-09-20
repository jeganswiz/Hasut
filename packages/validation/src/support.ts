import {
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  type SupportCategoryView,
  type SupportEscalationView,
  type SupportMessageView,
  type SupportNoteView,
  type SupportTicketDetail,
  type SupportTicketView,
} from "@hasut/types";
import { z } from "zod";
import { memberPreviewSchema } from "./social";

export const supportCategoryViewSchema: z.ZodType<SupportCategoryView> = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean(),
  sortOrder: z.number(),
});

export const supportCategoryListSchema = z.array(supportCategoryViewSchema);

export const supportTicketViewSchema: z.ZodType<SupportTicketView> = z.object({
  id: z.string().min(1),
  subject: z.string(),
  status: z.enum(SUPPORT_TICKET_STATUSES),
  priority: z.enum(SUPPORT_TICKET_PRIORITIES),
  category: supportCategoryViewSchema,
  member: memberPreviewSchema,
  assignee: memberPreviewSchema.nullable(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const supportTicketListSchema = z.array(supportTicketViewSchema);

export const supportMessageViewSchema: z.ZodType<SupportMessageView> = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  author: memberPreviewSchema,
  body: z.string(),
  isInternal: z.boolean(),
  createdAt: z.string(),
});

export const supportNoteViewSchema: z.ZodType<SupportNoteView> = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  author: memberPreviewSchema,
  body: z.string(),
  createdAt: z.string(),
});

export const supportEscalationViewSchema: z.ZodType<SupportEscalationView> = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  fromAssignee: memberPreviewSchema.nullable(),
  toAssignee: memberPreviewSchema,
  reason: z.string(),
  createdAt: z.string(),
});

export const supportTicketDetailSchema: z.ZodType<SupportTicketDetail> =
  supportTicketViewSchema.and(
    z.object({
      messages: z.array(supportMessageViewSchema),
      notes: z.array(supportNoteViewSchema),
      escalations: z.array(supportEscalationViewSchema),
    }),
  );

export const supportTicketCreateSchema = z.object({
  categoryId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4_000),
});

export const supportMessageCreateSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
});

export const supportTicketAssignSchema = z.object({
  assigneeId: z.string().uuid(),
});

export const supportTicketPatchSchema = z
  .object({
    status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
    priority: z.enum(SUPPORT_TICKET_PRIORITIES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const supportNoteCreateSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
});

export const supportEscalateSchema = z.object({
  toAssigneeId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1_000),
});

export const supportCategoryWriteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10_000).optional().default(100),
});
