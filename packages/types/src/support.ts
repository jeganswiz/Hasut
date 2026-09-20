export const SUPPORT_TICKET_STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];

export interface SupportCategoryView {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SupportTicketView {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: SupportCategoryView;
  member: MemberPreviewLike;
  assignee: MemberPreviewLike | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessageView {
  id: string;
  ticketId: string;
  author: MemberPreviewLike;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface SupportNoteView {
  id: string;
  ticketId: string;
  author: MemberPreviewLike;
  body: string;
  createdAt: string;
}

export interface SupportEscalationView {
  id: string;
  ticketId: string;
  fromAssignee: MemberPreviewLike | null;
  toAssignee: MemberPreviewLike;
  reason: string;
  createdAt: string;
}

export interface SupportTicketDetail extends SupportTicketView {
  messages: SupportMessageView[];
  notes: SupportNoteView[];
  escalations: SupportEscalationView[];
}

interface MemberPreviewLike {
  id: string;
  displayName: string;
  photoUrl: string | null;
}
