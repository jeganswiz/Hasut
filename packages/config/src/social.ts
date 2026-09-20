export interface MessagingPolicy {
  maxTextChars: number;
  pageSize: number;
  reconnectMs: number;
}

export const MESSAGING_POLICY_CONFIG_KEY = "messaging.policy";

/** Seed / fallback values owned by configuration, not chat use-cases. */
export const MESSAGING_POLICY_DEFAULTS: MessagingPolicy = {
  maxTextChars: 2_000,
  pageSize: 30,
  reconnectMs: 2_000,
};

export function isMessagingPolicy(value: unknown): value is MessagingPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.maxTextChars === "number" &&
    typeof record.pageSize === "number" &&
    typeof record.reconnectMs === "number"
  );
}

export function readMessagingPolicy(value: unknown): MessagingPolicy {
  if (!isMessagingPolicy(value)) {
    return MESSAGING_POLICY_DEFAULTS;
  }
  return { ...MESSAGING_POLICY_DEFAULTS, ...value };
}

export interface ReportReason {
  code: string;
  label: string;
}

export interface ReportsPolicy {
  reasonCodes: ReportReason[];
}

export const REPORTS_POLICY_CONFIG_KEY = "reports.policy";

export const REPORTS_POLICY_DEFAULTS: ReportsPolicy = {
  reasonCodes: [
    { code: "SPAM", label: "Spam" },
    { code: "HARASSMENT", label: "Harassment" },
    { code: "FAKE_PROFILE", label: "Fake profile" },
    { code: "INAPPROPRIATE", label: "Inappropriate content" },
    { code: "OTHER", label: "Other" },
  ],
};

export function isReportsPolicy(value: unknown): value is ReportsPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.reasonCodes) &&
    record.reasonCodes.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ReportReason).code === "string" &&
        typeof (item as ReportReason).label === "string",
    )
  );
}

export function readReportsPolicy(value: unknown): ReportsPolicy {
  if (!isReportsPolicy(value) || value.reasonCodes.length === 0) {
    return REPORTS_POLICY_DEFAULTS;
  }
  return { reasonCodes: value.reasonCodes };
}

export const NOTIFICATION_TEMPLATE_KEYS = [
  "connection.requested",
  "connection.accepted",
  "message.received",
  "verification.approved",
  "verification.rejected",
  "support.ticket.replied",
  "support.ticket.resolved",
] as const;

export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATE_KEYS)[number];
