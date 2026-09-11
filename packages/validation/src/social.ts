import { CONNECTION_STATUSES, MESSAGE_TYPES, REPORT_TARGET_TYPES } from "@hasut/types";
import { z } from "zod";

export const memberPreviewSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  photoUrl: z.string().nullable(),
});

export const connectionViewSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CONNECTION_STATUSES),
  direction: z.enum(["INCOMING", "OUTGOING"]),
  peer: memberPreviewSchema,
  conversationId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const connectionListSchema = z.array(connectionViewSchema);

export const connectionLookupSchema = z.object({
  connection: connectionViewSchema.nullable(),
});

export const connectionCreateSchema = z.object({
  addresseeId: z.string().uuid(),
});

export const messageViewSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  type: z.enum(MESSAGE_TYPES),
  body: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const conversationViewSchema = z.object({
  id: z.string().min(1),
  peer: memberPreviewSchema,
  lastMessage: messageViewSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const conversationListSchema = z.array(conversationViewSchema);

export const messagePageSchema = z.object({
  items: z.array(messageViewSchema),
  nextCursor: z.string().nullable(),
});

export const messageCreateSchema = z
  .object({
    type: z.enum(MESSAGE_TYPES),
    body: z.string().trim().max(2_000).optional(),
    mediaId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TEXT" && (value.body === undefined || value.body.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text is required", path: ["body"] });
    }
    if (value.type === "IMAGE" && value.mediaId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Image attachment is required",
        path: ["mediaId"],
      });
    }
  });

export const messageReadSchema = z.object({
  messageId: z.string().uuid(),
});

export const messageListQuerySchema = z.object({
  cursor: z.string().optional(),
});

export const blockCreateSchema = z.object({
  memberId: z.string().uuid(),
});

export const blockViewSchema = z.object({
  id: z.string().min(1),
  member: memberPreviewSchema,
  createdAt: z.string(),
});

export const blockListSchema = z.array(blockViewSchema);

export const reportCreateSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().uuid(),
  reasonCode: z.string().trim().min(1).max(40),
  details: z.string().trim().max(1_000).optional().default(""),
});

export const reportViewSchema = z.object({
  id: z.string().min(1),
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1),
  reasonCode: z.string(),
  details: z.string(),
  status: z.enum(["OPEN", "ACTIONED", "DISMISSED"]),
  createdAt: z.string(),
});

export const reportsPolicyViewSchema = z.object({
  reasonCodes: z.array(z.object({ code: z.string(), label: z.string() })),
});

export const messagingPolicyViewSchema = z.object({
  maxTextChars: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  reconnectMs: z.number().int().positive(),
});

export const notificationViewSchema = z.object({
  id: z.string().min(1),
  templateKey: z.string().min(1),
  title: z.string(),
  body: z.string(),
  payload: z.record(z.string()),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export const notificationListSchema = z.array(notificationViewSchema);

export const unreadCountViewSchema = z.object({
  notifications: z.number().int().nonnegative(),
  messages: z.number().int().nonnegative(),
});
