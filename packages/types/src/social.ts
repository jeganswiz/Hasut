export const CONNECTION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CONNECTION_DIRECTIONS = ["INCOMING", "OUTGOING"] as const;
export type ConnectionDirection = (typeof CONNECTION_DIRECTIONS)[number];

export const MESSAGE_TYPES = ["TEXT", "IMAGE"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const REPORT_TARGET_TYPES = ["MEMBER", "MESSAGE", "PROFILE", "BUSINESS", "SERVICE"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = ["OPEN", "ACTIONED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Public peer card — never includes phone or exact coordinates. */
export interface MemberPreview {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

export interface ConnectionLookup {
  connection: ConnectionView | null;
}

export interface ConnectionView {
  id: string;
  status: ConnectionStatus;
  direction: ConnectionDirection;
  peer: MemberPreview;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationView {
  id: string;
  peer: MemberPreview;
  lastMessage: MessageView | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface MessagePage {
  items: MessageView[];
  nextCursor: string | null;
}

export interface BlockView {
  id: string;
  member: MemberPreview;
  createdAt: string;
}

export interface ReportView {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
}

export interface ReportReasonView {
  code: string;
  label: string;
}

export interface ReportsPolicyView {
  reasonCodes: ReportReasonView[];
}

export interface MessagingPolicyView {
  maxTextChars: number;
  pageSize: number;
  reconnectMs: number;
}

export interface NotificationView {
  id: string;
  templateKey: string;
  title: string;
  body: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCountView {
  notifications: number;
  messages: number;
}
