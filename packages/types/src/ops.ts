import type { MemberPreview } from "./social";
import type { IdentityVerificationRequest } from "./catalog";
import type { ReportView } from "./social";

export const VERIFICATION_DECISIONS = ["APPROVE", "REJECT"] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

export const REPORT_MODERATION_ACTIONS = ["HIDE", "DISMISS"] as const;
export type ReportModerationAction = (typeof REPORT_MODERATION_ACTIONS)[number];

export interface AdminVerificationRequest extends IdentityVerificationRequest {
  member: MemberPreview;
  reviewNote: string | null;
}

export interface AdminReportView extends ReportView {
  reporter: MemberPreview;
  hidden: boolean;
}

export interface NotificationTemplateView {
  id: string;
  key: string;
  channel: "IN_APP";
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
}

export interface OpsSummaryView {
  pendingVerifications: number;
  openReports: number;
  openTickets: number;
  suspendedMembers: number;
}

export interface StaffMemberView {
  id: string;
  displayName: string;
  roles: string[];
}

export interface AdminMemberView {
  id: string;
  displayName: string;
  status: string;
  roles: string[];
  createdAt: string;
}

export interface AdminMemberDetail extends AdminMemberView {
  sessionCount: number;
}

export interface AuditLogView {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  requestId: string;
  createdAt: string;
}

export interface FeatureFlagAdminView {
  key: string;
  enabled: boolean;
  description: string;
}

export interface ThemeEditorView {
  version: number;
  status: "DRAFT" | "PUBLISHED";
  tokens: import("./theme").ThemeTokens;
  logoUrl: string | null;
  contrastWarnings: string[];
}

export interface AdminProfessionalView {
  id: string;
  memberId: string;
  displayName: string;
  headline: string;
  status: string;
  identityVerificationStatus: string;
}

export interface AdminBusinessView {
  id: string;
  name: string;
  status: string;
  ownerDisplayName: string;
}
