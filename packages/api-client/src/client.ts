import type { TokenStorage } from "@hasut/auth";
import {
  REQUEST_ID_HEADER,
  fail,
  type ApiEnvelope,
  type ApiFailure,
  type AuthSessionView,
  type AuthTokens,
  type AuthVerifyResult,
  type CurrentMember,
  type HealthData,
  type LogoutAllResult,
  type LogoutResult,
  type MediaAssetView,
  type MediaPresignResult,
  type OtpChallengeReceipt,
  type OwnerLocation,
  type OwnerMemberProfile,
  type PublicFlagsConfig,
  type PublicMemberProfile,
  type PublicProfessional,
  type PublicThemeConfig,
  type CategoryView,
  type IdentityVerificationRequest,
  type OwnerProfessional,
  type ProfessionalOnboarding,
  type DiscoveryKind,
  type DiscoveryPolicyView,
  type DiscoveryPreview,
  type DiscoveryRankingWeightsView,
  type DiscoveryResult,
  type MapBasemapProvider,
  type PublicBusiness,
  type BlockView,
  type ConnectionLookup,
  type ConnectionView,
  type ConversationView,
  type MessagePage,
  type MessageView,
  type MessagingPolicyView,
  type NotificationView,
  type ReportView,
  type ReportsPolicyView,
  type UnreadCountView,
} from "@hasut/types";
import { createRequestId, normalizeRequestId } from "@hasut/utils";
import {
  apiFailureSchema,
  authSessionListSchema,
  authTokensSchema,
  authVerifyResultSchema,
  currentMemberSchema,
  healthDataSchema,
  logoutAllResultSchema,
  currentModeListSchema,
  logoutResultSchema,
  mediaAssetViewSchema,
  mediaPresignResultSchema,
  otpChallengeReceiptSchema,
  ownerLocationSchema,
  ownerMemberProfileSchema,
  publicFlagsConfigSchema,
  publicMemberProfileSchema,
  publicThemeConfigSchema,
  categoryListSchema,
  categoryViewSchema,
  identityVerificationRequestSchema,
  ownerProfessionalSchema,
  professionalOnboardingSchema,
  publicProfessionalSchema,
  discoveryPolicyViewSchema,
  discoveryPreviewSchema,
  discoveryRankingWeightsViewSchema,
  discoveryResultSchema,
  publicBusinessSchema,
  blockListSchema,
  blockViewSchema,
  connectionListSchema,
  connectionLookupSchema,
  connectionViewSchema,
  conversationListSchema,
  conversationViewSchema,
  messagePageSchema,
  messageViewSchema,
  messagingPolicyViewSchema,
  notificationListSchema,
  notificationViewSchema,
  reportViewSchema,
  reportsPolicyViewSchema,
  unreadCountViewSchema,
} from "@hasut/validation";
import { z, type ZodType } from "zod";
import { createAxiosHttpAdapter, HASUT_UPLOAD_TIMEOUT_MS, type HasutHttpAdapter } from "./http";

export class HasutApiError extends Error {
  public readonly envelope: ApiFailure;

  constructor(envelope: ApiFailure) {
    super(envelope.error.message);
    this.name = "HasutApiError";
    this.envelope = envelope;
  }
}

export interface HasutApiClientOptions {
  baseUrl: string;
  tokenStorage?: TokenStorage;
  http?: HasutHttpAdapter;
  getRequestId?: () => string;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === "string") {
    return body.length === 0 ? undefined : (JSON.parse(body) as unknown);
  }
  return body;
}

function normalizeResponseData(data: unknown): unknown {
  if (data === undefined || data === null || data === "") {
    return {};
  }
  if (typeof data === "string") {
    return JSON.parse(data) as unknown;
  }
  return data;
}

function browserDocumentOrigin(): string | undefined {
  const location = (globalThis as { location?: { origin?: unknown } }).location;
  return typeof location?.origin === "string" && location.origin.length > 0
    ? location.origin
    : undefined;
}

function toQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded.length === 0 ? "" : `?${encoded}`;
}

export class HasutApiClient {
  private readonly baseUrl: string;
  private readonly tokenStorage: TokenStorage | undefined;
  private readonly http: HasutHttpAdapter;
  private readonly getRequestId: () => string;

  constructor(options: HasutApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.tokenStorage = options.tokenStorage;
    this.http = options.http ?? createAxiosHttpAdapter();
    this.getRequestId = options.getRequestId ?? createRequestId;
  }

  async health(kind: "live" | "ready" = "ready"): Promise<HealthData> {
    const path = kind === "live" ? "/api/v1/health/live" : "/api/v1/health/ready";
    const result = await this.request(healthDataSchema, path, { method: "GET" });
    return result.data;
  }

  async requestOtp(body: {
    phone: string;
    purpose?: "LOGIN" | "REAUTH";
    deviceId?: string;
  }): Promise<OtpChallengeReceipt> {
    const result = await this.request(otpChallengeReceiptSchema, "/api/v1/auth/otp/request", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async verifyOtp(body: {
    phone: string;
    code: string;
    purpose?: "LOGIN" | "REAUTH";
    deviceId?: string;
  }): Promise<AuthVerifyResult> {
    const result = await this.request(authVerifyResultSchema, "/api/v1/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async resendOtp(body: {
    phone: string;
    purpose?: "LOGIN" | "REAUTH";
    deviceId?: string;
  }): Promise<OtpChallengeReceipt> {
    const result = await this.request(otpChallengeReceiptSchema, "/api/v1/auth/otp/resend", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async refresh(body: { refreshToken: string; deviceId?: string }): Promise<AuthTokens> {
    const result = await this.request(authTokensSchema, "/api/v1/auth/token/refresh", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async logout(body: { sessionId?: string } = {}): Promise<LogoutResult> {
    const result = await this.request(logoutResultSchema, "/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async logoutAll(): Promise<LogoutAllResult> {
    const result = await this.request(logoutAllResultSchema, "/api/v1/auth/logout-all", {
      method: "POST",
    });
    return result.data;
  }

  async sessions(): Promise<AuthSessionView[]> {
    const result = await this.request(authSessionListSchema, "/api/v1/auth/sessions", {
      method: "GET",
    });
    return result.data;
  }

  async me(): Promise<CurrentMember> {
    const result = await this.request(currentMemberSchema, "/api/v1/me", { method: "GET" });
    return result.data;
  }

  async theme(): Promise<PublicThemeConfig> {
    const result = await this.request(publicThemeConfigSchema, "/api/v1/config/theme", {
      method: "GET",
    });
    return result.data;
  }

  async flags(): Promise<PublicFlagsConfig> {
    const result = await this.request(publicFlagsConfigSchema, "/api/v1/config/flags", {
      method: "GET",
    });
    return result.data;
  }

  async getMyProfile(): Promise<OwnerMemberProfile> {
    const result = await this.request(ownerMemberProfileSchema, "/api/v1/me/profile", {
      method: "GET",
    });
    return result.data;
  }

  async putMyProfile(body: {
    displayName: string;
    bio?: string;
    photoMediaId?: string | null;
    currentModeCode?: string | null;
    statusText?: string;
    isDiscoverable?: boolean;
  }): Promise<OwnerMemberProfile> {
    const result = await this.request(ownerMemberProfileSchema, "/api/v1/me/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async patchMyProfile(body: {
    displayName?: string;
    bio?: string;
    photoMediaId?: string | null;
    currentModeCode?: string | null;
    statusText?: string;
    isDiscoverable?: boolean;
  }): Promise<OwnerMemberProfile> {
    const result = await this.request(ownerMemberProfileSchema, "/api/v1/me/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async putMyMode(body: { modeCode: string; statusText?: string }): Promise<OwnerMemberProfile> {
    const result = await this.request(ownerMemberProfileSchema, "/api/v1/me/mode", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async getMyLocation(): Promise<OwnerLocation> {
    const result = await this.request(ownerLocationSchema, "/api/v1/me/location", {
      method: "GET",
    });
    return result.data;
  }

  async putMyLocation(body: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  }): Promise<OwnerLocation> {
    const result = await this.request(ownerLocationSchema, "/api/v1/me/location", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async patchLocationPermission(body: {
    status: "PROMPT" | "GRANTED" | "DENIED";
  }): Promise<OwnerLocation> {
    const result = await this.request(ownerLocationSchema, "/api/v1/me/location/permission", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async getMember(memberId: string): Promise<PublicMemberProfile> {
    const result = await this.request(publicMemberProfileSchema, `/api/v1/members/${memberId}`, {
      method: "GET",
    });
    return result.data;
  }

  async listCurrentModes() {
    const result = await this.request(currentModeListSchema, "/api/v1/current-modes", {
      method: "GET",
    });
    return result.data;
  }

  async presignMedia(body: {
    purpose: "AVATAR" | "PORTFOLIO" | "CHAT" | "BUSINESS" | "VERIFICATION" | "THEME_LOGO";
    mimeType: string;
    byteSize: number;
  }): Promise<MediaPresignResult> {
    const result = await this.request(mediaPresignResultSchema, "/api/v1/media/presign", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async completeMedia(body: { mediaId: string }): Promise<MediaAssetView> {
    const result = await this.request(mediaAssetViewSchema, "/api/v1/media/complete", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async uploadPresigned(
    uploadUrl: string,
    body: Blob | ArrayBuffer | Uint8Array,
    headers: Record<string, string>,
  ): Promise<void> {
    const requestId = normalizeRequestId(this.getRequestId());
    let status: number;
    try {
      const response = await this.http.request({
        url: uploadUrl,
        method: "PUT",
        headers,
        data: body,
        timeoutMs: HASUT_UPLOAD_TIMEOUT_MS,
      });
      status = response.status;
    } catch {
      throw new HasutApiError(fail("SERVICE_UNAVAILABLE", "Unable to upload media", requestId));
    }
    if (status < 200 || status >= 300) {
      throw new HasutApiError(fail("SERVICE_UNAVAILABLE", "Unable to upload media", requestId));
    }
  }

  async listCategories(
    appliesTo?: "PROFESSIONAL" | "BUSINESS" | "SERVICE" | "ALL",
  ): Promise<CategoryView[]> {
    const query = appliesTo === undefined ? "" : `?appliesTo=${appliesTo}`;
    const result = await this.request(categoryListSchema, `/api/v1/categories${query}`, {
      method: "GET",
    });
    return result.data;
  }

  async listAdminCategories(): Promise<CategoryView[]> {
    const result = await this.request(categoryListSchema, "/api/v1/admin/categories", {
      method: "GET",
    });
    return result.data;
  }

  async createCategory(body: {
    name: string;
    slug?: string;
    parentId?: string | null;
    appliesTo?: "PROFESSIONAL" | "BUSINESS" | "SERVICE" | "ALL";
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<CategoryView> {
    const result = await this.request(categoryViewSchema, "/api/v1/admin/categories", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async patchCategory(
    categoryId: string,
    body: {
      name?: string;
      slug?: string;
      parentId?: string | null;
      appliesTo?: "PROFESSIONAL" | "BUSINESS" | "SERVICE" | "ALL";
      isActive?: boolean;
      sortOrder?: number;
    },
  ): Promise<CategoryView> {
    const result = await this.request(
      categoryViewSchema,
      `/api/v1/admin/categories/${categoryId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
    return result.data;
  }

  async deleteCategory(categoryId: string): Promise<CategoryView> {
    const result = await this.request(
      categoryViewSchema,
      `/api/v1/admin/categories/${categoryId}`,
      { method: "DELETE" },
    );
    return result.data;
  }

  async getProfessionalOnboarding(): Promise<ProfessionalOnboarding> {
    const result = await this.request(
      professionalOnboardingSchema,
      "/api/v1/me/professional/onboarding",
      { method: "GET" },
    );
    return result.data;
  }

  async startProfessionalOnboarding(): Promise<ProfessionalOnboarding> {
    const result = await this.request(
      professionalOnboardingSchema,
      "/api/v1/me/professional/onboarding/start",
      { method: "POST" },
    );
    return result.data;
  }

  async saveOnboardingCategories(body: { categoryIds: string[] }): Promise<ProfessionalOnboarding> {
    const result = await this.request(
      professionalOnboardingSchema,
      "/api/v1/me/professional/onboarding/categories",
      { method: "PUT", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async saveOnboardingProfile(body: {
    headline?: string;
    experienceYears: number;
    availability: string;
    skills?: Array<{ label: string; categoryId?: string | null }>;
  }): Promise<ProfessionalOnboarding> {
    const result = await this.request(
      professionalOnboardingSchema,
      "/api/v1/me/professional/onboarding/profile",
      { method: "PUT", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async saveOnboardingServiceArea(body: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }): Promise<ProfessionalOnboarding> {
    const result = await this.request(
      professionalOnboardingSchema,
      "/api/v1/me/professional/onboarding/service-area",
      { method: "PUT", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async submitProfessionalOnboarding(): Promise<ProfessionalOnboarding> {
    const result = await this.request(
      professionalOnboardingSchema,
      "/api/v1/me/professional/onboarding/submit",
      { method: "POST" },
    );
    return result.data;
  }

  async getMyProfessional(): Promise<OwnerProfessional> {
    const result = await this.request(ownerProfessionalSchema, "/api/v1/me/professional", {
      method: "GET",
    });
    return result.data;
  }

  async patchMyProfessional(body: { status: "ACTIVE" | "PAUSED" }): Promise<OwnerProfessional> {
    const result = await this.request(ownerProfessionalSchema, "/api/v1/me/professional", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async getProfessional(professionalId: string): Promise<PublicProfessional> {
    const result = await this.request(
      publicProfessionalSchema,
      `/api/v1/professionals/${professionalId}`,
      { method: "GET" },
    );
    return result.data;
  }

  async requestIdentityVerification(body: {
    documentMediaIds: string[];
  }): Promise<IdentityVerificationRequest> {
    const result = await this.request(
      identityVerificationRequestSchema,
      "/api/v1/verification/identity",
      { method: "POST", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async getIdentityVerification(): Promise<IdentityVerificationRequest> {
    const result = await this.request(
      identityVerificationRequestSchema,
      "/api/v1/verification/identity",
      { method: "GET" },
    );
    return result.data;
  }

  async getDiscoveryPolicy(): Promise<DiscoveryPolicyView> {
    const result = await this.request(discoveryPolicyViewSchema, "/api/v1/config/discovery", {
      method: "GET",
    });
    return result.data;
  }

  async nearby(query: {
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    kinds?: DiscoveryKind[];
    categoryId?: string;
    verified?: boolean;
    available?: boolean;
    q?: string;
  }): Promise<DiscoveryResult> {
    const result = await this.request(
      discoveryResultSchema,
      `/api/v1/discovery/nearby${toQuery(query)}`,
      { method: "GET" },
    );
    return result.data;
  }

  async searchNearby(query: {
    q: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    kinds?: DiscoveryKind[];
    categoryId?: string;
    verified?: boolean;
    available?: boolean;
  }): Promise<DiscoveryResult> {
    const result = await this.request(
      discoveryResultSchema,
      `/api/v1/discovery/search${toQuery(query)}`,
      { method: "GET" },
    );
    return result.data;
  }

  async getDiscoveryPreview(
    kind: DiscoveryKind,
    id: string,
    query: {
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
    } = {},
  ): Promise<DiscoveryPreview> {
    const result = await this.request(
      discoveryPreviewSchema,
      `/api/v1/discovery/preview/${kind}/${id}${toQuery(query)}`,
      { method: "GET" },
    );
    return result.data;
  }

  async getBusiness(businessId: string): Promise<PublicBusiness> {
    const result = await this.request(publicBusinessSchema, `/api/v1/businesses/${businessId}`, {
      method: "GET",
    });
    return result.data;
  }

  async createBusiness(body: {
    name: string;
    description?: string;
    categoryIds: string[];
    latitude: number;
    longitude: number;
  }): Promise<PublicBusiness> {
    const result = await this.request(publicBusinessSchema, "/api/v1/me/businesses", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async getAdminDiscoveryPolicy(): Promise<DiscoveryPolicyView> {
    const result = await this.request(discoveryPolicyViewSchema, "/api/v1/admin/discovery/policy", {
      method: "GET",
    });
    return result.data;
  }

  async patchAdminDiscoveryPolicy(body: {
    defaultRadiusMeters?: number;
    minRadiusMeters?: number;
    maxRadiusMeters?: number;
    radiusOptionsMeters?: number[];
    clusterCellMeters?: number;
    includeMembers?: boolean;
    mapProvider?: MapBasemapProvider;
    mapCustomTileUrl?: string;
    mapTileUrl?: string;
  }): Promise<DiscoveryPolicyView> {
    const result = await this.request(discoveryPolicyViewSchema, "/api/v1/admin/discovery/policy", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async getAdminDiscoveryWeights(): Promise<DiscoveryRankingWeightsView> {
    const result = await this.request(
      discoveryRankingWeightsViewSchema,
      "/api/v1/admin/discovery/weights",
      { method: "GET" },
    );
    return result.data;
  }

  async patchAdminDiscoveryWeights(body: {
    distance: number;
    categoryRelevance: number;
    availability: number;
    verification: number;
    rating: number;
    activity: number;
  }): Promise<DiscoveryRankingWeightsView> {
    const result = await this.request(
      discoveryRankingWeightsViewSchema,
      "/api/v1/admin/discovery/weights",
      { method: "PATCH", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async getMessagingPolicy(): Promise<MessagingPolicyView> {
    const result = await this.request(messagingPolicyViewSchema, "/api/v1/config/messaging", {
      method: "GET",
    });
    return result.data;
  }

  async getReportsPolicy(): Promise<ReportsPolicyView> {
    const result = await this.request(reportsPolicyViewSchema, "/api/v1/config/reports", {
      method: "GET",
    });
    return result.data;
  }

  async listConnections(): Promise<ConnectionView[]> {
    const result = await this.request(connectionListSchema, "/api/v1/connections", {
      method: "GET",
    });
    return result.data;
  }

  async getConnectionWith(memberId: string): Promise<ConnectionLookup> {
    const result = await this.request(
      connectionLookupSchema,
      `/api/v1/connections/with/${memberId}`,
      { method: "GET" },
    );
    return result.data;
  }

  async requestConnection(addresseeId: string): Promise<ConnectionView> {
    const result = await this.request(connectionViewSchema, "/api/v1/connections", {
      method: "POST",
      body: JSON.stringify({ addresseeId }),
    });
    return result.data;
  }

  async acceptConnection(connectionId: string): Promise<ConnectionView> {
    const result = await this.request(
      connectionViewSchema,
      `/api/v1/connections/${connectionId}/accept`,
      { method: "POST" },
    );
    return result.data;
  }

  async rejectConnection(connectionId: string): Promise<ConnectionView> {
    const result = await this.request(
      connectionViewSchema,
      `/api/v1/connections/${connectionId}/reject`,
      { method: "POST" },
    );
    return result.data;
  }

  async cancelConnection(connectionId: string): Promise<ConnectionView> {
    const result = await this.request(
      connectionViewSchema,
      `/api/v1/connections/${connectionId}/cancel`,
      { method: "POST" },
    );
    return result.data;
  }

  async listConversations(): Promise<ConversationView[]> {
    const result = await this.request(conversationListSchema, "/api/v1/conversations", {
      method: "GET",
    });
    return result.data;
  }

  async getConversation(conversationId: string): Promise<ConversationView> {
    const result = await this.request(
      conversationViewSchema,
      `/api/v1/conversations/${conversationId}`,
      { method: "GET" },
    );
    return result.data;
  }

  async listMessages(conversationId: string, cursor?: string): Promise<MessagePage> {
    const result = await this.request(
      messagePageSchema,
      `/api/v1/conversations/${conversationId}/messages${toQuery({ cursor })}`,
      { method: "GET" },
    );
    return result.data;
  }

  async sendMessage(
    conversationId: string,
    body: { type: "TEXT" | "IMAGE"; body?: string; mediaId?: string },
  ): Promise<MessageView> {
    const result = await this.request(
      messageViewSchema,
      `/api/v1/conversations/${conversationId}/messages`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async markMessagesRead(conversationId: string, messageId: string): Promise<{ updated: number }> {
    const result = await this.request(
      z.object({ updated: z.number() }),
      `/api/v1/conversations/${conversationId}/read`,
      { method: "POST", body: JSON.stringify({ messageId }) },
    );
    return result.data;
  }

  async listBlocks(): Promise<BlockView[]> {
    const result = await this.request(blockListSchema, "/api/v1/blocks", { method: "GET" });
    return result.data;
  }

  async blockMember(memberId: string): Promise<BlockView> {
    const result = await this.request(blockViewSchema, "/api/v1/blocks", {
      method: "POST",
      body: JSON.stringify({ memberId }),
    });
    return result.data;
  }

  async unblockMember(memberId: string): Promise<{ removed: boolean }> {
    const result = await this.request(
      z.object({ removed: z.boolean() }),
      `/api/v1/blocks/${memberId}`,
      { method: "DELETE" },
    );
    return result.data;
  }

  async createReport(body: {
    targetType: "MEMBER" | "MESSAGE" | "PROFILE" | "BUSINESS" | "SERVICE";
    targetId: string;
    reasonCode: string;
    details?: string;
  }): Promise<ReportView> {
    const result = await this.request(reportViewSchema, "/api/v1/reports", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async listNotifications(): Promise<NotificationView[]> {
    const result = await this.request(notificationListSchema, "/api/v1/notifications", {
      method: "GET",
    });
    return result.data;
  }

  async getUnreadCount(): Promise<UnreadCountView> {
    const result = await this.request(unreadCountViewSchema, "/api/v1/notifications/unread-count", {
      method: "GET",
    });
    return result.data;
  }

  async markNotificationRead(notificationId: string): Promise<NotificationView> {
    const result = await this.request(
      notificationViewSchema,
      `/api/v1/notifications/${notificationId}/read`,
      { method: "POST" },
    );
    return result.data;
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    const result = await this.request(
      z.object({ updated: z.number() }),
      "/api/v1/notifications/read-all",
      {
        method: "POST",
      },
    );
    return result.data;
  }

  private async request<T>(
    dataSchema: ZodType<T>,
    path: string,
    init: RequestInit,
  ): Promise<{ data: T; requestId: string }> {
    const requestId = normalizeRequestId(this.getRequestId());
    const headers = new Headers(init.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.set("Accept", "application/json");
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const accessToken = this.tokenStorage ? await this.tokenStorage.getAccessToken() : null;
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    let raw: unknown;
    try {
      const response = await this.http.request({
        url: this.buildUrl(path),
        method: init.method ?? "GET",
        headers: headersToRecord(headers),
        data: parseJsonBody(init.body),
      });
      raw = response.data;
    } catch {
      throw new HasutApiError(
        fail("SERVICE_UNAVAILABLE", "Unable to reach the HASUT API", requestId),
      );
    }

    let json: unknown;
    try {
      json = normalizeResponseData(raw);
    } catch {
      throw new HasutApiError(
        fail("SERVICE_UNAVAILABLE", "The API did not return a valid response", requestId),
      );
    }
    const failureParse = apiFailureSchema.safeParse(json);
    if (failureParse.success) {
      throw new HasutApiError(failureParse.data);
    }

    if (!isRecord(json) || json.success !== true || !isRecord(json.meta)) {
      throw new HasutApiError(fail("INTERNAL_ERROR", "Unexpected API response", requestId));
    }

    const parsedRequestId =
      typeof json.meta.requestId === "string" ? json.meta.requestId : requestId;

    return {
      data: dataSchema.parse(json.data),
      requestId: parsedRequestId,
    };
  }

  private buildUrl(path: string): string {
    const joined = `${this.baseUrl}${path}`;
    if (/^https?:\/\//i.test(joined)) {
      return joined;
    }
    const origin = browserDocumentOrigin();
    if (origin !== undefined) {
      return new URL(joined.startsWith("/") ? joined : `/${joined}`, origin).toString();
    }
    return joined;
  }
}

export function createHasutApiClient(options: HasutApiClientOptions): HasutApiClient {
  return new HasutApiClient(options);
}

export function isHasutApiError(error: unknown): error is HasutApiError {
  if (error instanceof HasutApiError) {
    return true;
  }
  if (!(error instanceof Error) || error.name !== "HasutApiError" || !("envelope" in error)) {
    return false;
  }
  return isRecord(error.envelope);
}

export function getEnvelopeFromUnknown(error: unknown): ApiEnvelope<unknown> | null {
  if (!isHasutApiError(error)) {
    return null;
  }
  return error.envelope;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const envelope = getEnvelopeFromUnknown(error);
  if (envelope !== null && envelope.success === false) {
    return envelope.error.message;
  }
  return fallback;
}

export function hasutErrorCode(error: unknown): string | null {
  const envelope = getEnvelopeFromUnknown(error);
  if (envelope !== null && envelope.success === false) {
    return envelope.error.code;
  }
  return null;
}
