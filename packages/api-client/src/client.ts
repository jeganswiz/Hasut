import type { TokenStorage } from "@hasut/auth";
import {
  REQUEST_ID_HEADER,
  fail,
  type ApiEnvelope,
  type ApiFailure,
  type AuthClientConfig,
  type AuthLoginResult,
  type AuthSessionView,
  type AuthTokens,
  type AuthVerifyResult,
  type CurrentMember,
  type IdentityProviderName,
  type PasswordResetTicket,
  type PasswordUpdateResult,
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
  type AdminReportView,
  type AdminVerificationRequest,
  type NotificationTemplateView,
  type OpsSummaryView,
  type StaffMemberView,
  type SupportCategoryView,
  type SupportEscalationView,
  type SupportMessageView,
  type SupportNoteView,
  type SupportTicketDetail,
  type SupportTicketView,
  type AdminBusinessView,
  type AdminMemberDetail,
  type AdminMemberView,
  type AdminProfessionalView,
  type AuditLogView,
  type FeatureFlagAdminView,
  type ThemeEditorView,
  type ReviewView,
  type ServiceOfferingView,
  type StoryView,
  type AudioTrackView,
  type StoryAudience,
  type StoryAudioSource,
  type StoryComposerConfig,
  type StoryOriginalAudioMode,
  type LiveSessionView,
  type ThemeTokens,
} from "@hasut/types";
import { createRequestId, normalizeRequestId } from "@hasut/utils";
import {
  apiFailureSchema,
  authClientConfigSchema,
  authLoginResultSchema,
  authSessionListSchema,
  authTokensSchema,
  authVerifyResultSchema,
  currentMemberSchema,
  passwordResetTicketSchema,
  passwordUpdateResultSchema,
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
  adminReportListSchema,
  adminReportViewSchema,
  adminVerificationListSchema,
  adminVerificationRequestSchema,
  notificationTemplateListSchema,
  notificationTemplateViewSchema,
  opsSummaryViewSchema,
  staffMemberListSchema,
  supportCategoryListSchema,
  supportEscalationViewSchema,
  supportMessageViewSchema,
  supportNoteViewSchema,
  supportTicketDetailSchema,
  supportTicketListSchema,
  supportTicketViewSchema,
  adminMemberDetailSchema,
  adminMemberListSchema,
  adminBusinessListSchema,
  adminProfessionalListSchema,
  auditLogListSchema,
  featureFlagAdminListSchema,
  featureFlagAdminViewSchema,
  themeEditorViewSchema,
  serviceOfferingListSchema,
  serviceOfferingViewSchema,
  reviewListSchema,
  reviewViewSchema,
  reviewAggregateViewSchema,
  storyListSchema,
  storyViewSchema,
  storyComposerConfigSchema,
  audioTrackListSchema,
  audioTrackViewSchema,
  livePresenceViewSchema,
  liveSessionListSchema,
  liveSessionViewSchema,
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

/** A one-time code goes to a phone or an email, never both. */
export interface OtpDestinationInput {
  phone?: string;
  email?: string;
  purpose?: "LOGIN" | "REAUTH" | "PASSWORD_RESET" | "TWO_FACTOR";
  deviceId?: string;
  captchaToken?: string;
}

export interface StoryAudioInput {
  source: StoryAudioSource;
  /** Set when `source` is `LIBRARY`. */
  trackId?: string | null;
  /** Set when `source` is `UPLOAD`. */
  mediaId?: string | null;
  startSeconds?: number;
  endSeconds?: number | null;
}

export interface StoryCreateInput {
  kind: "IMAGE" | "VIDEO";
  imageMediaId?: string;
  videoMediaId?: string;
  caption?: string;
  captionColor?: string | null;
  audio?: StoryAudioInput;
  originalAudioMode?: StoryOriginalAudioMode;
  audience?: StoryAudience;
  trimStartSeconds?: number;
  trimEndSeconds?: number | null;
}

export interface AudioTrackUpsertInput {
  title: string;
  artist: string;
  mediaId: string;
  durationSeconds: number;
  mood: string;
  isActive?: boolean;
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

  async authConfig(): Promise<AuthClientConfig> {
    const result = await this.request(authClientConfigSchema, "/api/v1/auth/config", {
      method: "GET",
    });
    return result.data;
  }

  async requestOtp(body: OtpDestinationInput): Promise<OtpChallengeReceipt> {
    const result = await this.request(otpChallengeReceiptSchema, "/api/v1/auth/otp/request", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async verifyOtp(body: OtpDestinationInput & { code: string }): Promise<AuthVerifyResult> {
    const result = await this.request(authVerifyResultSchema, "/api/v1/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async resendOtp(body: OtpDestinationInput): Promise<OtpChallengeReceipt> {
    const result = await this.request(otpChallengeReceiptSchema, "/api/v1/auth/otp/resend", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async register(body: {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
    deviceId?: string;
    captchaToken?: string;
  }): Promise<AuthVerifyResult> {
    const result = await this.request(authVerifyResultSchema, "/api/v1/auth/password/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async loginWithPassword(body: {
    email: string;
    password: string;
    deviceId?: string;
    captchaToken?: string;
  }): Promise<AuthLoginResult> {
    const result = await this.request(authLoginResultSchema, "/api/v1/auth/password/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async verifyTwoFactor(body: {
    challengeId: string;
    code: string;
    deviceId?: string;
    captchaToken?: string;
  }): Promise<AuthVerifyResult> {
    const result = await this.request(authVerifyResultSchema, "/api/v1/auth/two-factor/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async loginWithSso(body: {
    provider: IdentityProviderName;
    token: string;
    deviceId?: string;
    captchaToken?: string;
  }): Promise<AuthVerifyResult> {
    const result = await this.request(authVerifyResultSchema, "/api/v1/auth/sso", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async forgotPassword(
    body: OtpDestinationInput & { captchaToken?: string },
  ): Promise<OtpChallengeReceipt> {
    const result = await this.request(otpChallengeReceiptSchema, "/api/v1/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async verifyPasswordReset(body: {
    challengeId: string;
    code: string;
    captchaToken?: string;
  }): Promise<PasswordResetTicket> {
    const result = await this.request(
      passwordResetTicketSchema,
      "/api/v1/auth/password/reset/verify",
      { method: "POST", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async resetPassword(body: { ticket: string; password: string }): Promise<PasswordUpdateResult> {
    const result = await this.request(passwordUpdateResultSchema, "/api/v1/auth/password/reset", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async changePassword(body: {
    currentPassword: string;
    password: string;
  }): Promise<PasswordUpdateResult> {
    const result = await this.request(passwordUpdateResultSchema, "/api/v1/auth/password", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async setTwoFactor(enabled: boolean): Promise<CurrentMember> {
    const result = await this.request(currentMemberSchema, "/api/v1/auth/two-factor", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
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
    purpose:
      | "AVATAR"
      | "PORTFOLIO"
      | "CHAT"
      | "BUSINESS"
      | "VERIFICATION"
      | "THEME_LOGO"
      | "STORY_IMAGE"
      | "STORY_VIDEO"
      | "STORY_AUDIO";
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

  async listAdminVerification(): Promise<AdminVerificationRequest[]> {
    const result = await this.request(adminVerificationListSchema, "/api/v1/admin/verification", {
      method: "GET",
    });
    return result.data;
  }

  async decideVerification(
    requestId: string,
    body: { decision: "APPROVE" | "REJECT"; reviewNote?: string },
  ): Promise<AdminVerificationRequest> {
    const result = await this.request(
      adminVerificationRequestSchema,
      `/api/v1/admin/verification/${requestId}/decide`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async listAdminReports(): Promise<AdminReportView[]> {
    const result = await this.request(adminReportListSchema, "/api/v1/admin/reports", {
      method: "GET",
    });
    return result.data;
  }

  async moderateReport(reportId: string, action: "HIDE" | "DISMISS"): Promise<AdminReportView> {
    const result = await this.request(
      adminReportViewSchema,
      `/api/v1/admin/reports/${reportId}/moderate`,
      { method: "POST", body: JSON.stringify({ action }) },
    );
    return result.data;
  }

  async listNotificationTemplates(): Promise<NotificationTemplateView[]> {
    const result = await this.request(
      notificationTemplateListSchema,
      "/api/v1/admin/notification-templates",
      { method: "GET" },
    );
    return result.data;
  }

  async updateNotificationTemplate(
    templateId: string,
    body: { titleTemplate: string; bodyTemplate: string; isActive?: boolean },
  ): Promise<NotificationTemplateView> {
    const result = await this.request(
      notificationTemplateViewSchema,
      `/api/v1/admin/notification-templates/${templateId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async getOpsSummary(): Promise<OpsSummaryView> {
    const result = await this.request(opsSummaryViewSchema, "/api/v1/admin/ops/summary", {
      method: "GET",
    });
    return result.data;
  }

  async listStaff(): Promise<StaffMemberView[]> {
    const result = await this.request(staffMemberListSchema, "/api/v1/admin/staff", {
      method: "GET",
    });
    return result.data;
  }

  async listSupportCategories(): Promise<SupportCategoryView[]> {
    const result = await this.request(supportCategoryListSchema, "/api/v1/support/categories", {
      method: "GET",
    });
    return result.data;
  }

  async createSupportTicket(body: {
    categoryId: string;
    subject: string;
    body: string;
  }): Promise<SupportTicketDetail> {
    const result = await this.request(supportTicketDetailSchema, "/api/v1/support/tickets", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async listSupportTickets(): Promise<SupportTicketView[]> {
    const result = await this.request(supportTicketListSchema, "/api/v1/support/tickets", {
      method: "GET",
    });
    return result.data;
  }

  async getSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
    const result = await this.request(
      supportTicketDetailSchema,
      `/api/v1/support/tickets/${ticketId}`,
      { method: "GET" },
    );
    return result.data;
  }

  async replySupportTicket(ticketId: string, body: string): Promise<SupportMessageView> {
    const result = await this.request(
      supportMessageViewSchema,
      `/api/v1/support/tickets/${ticketId}/messages`,
      { method: "POST", body: JSON.stringify({ body }) },
    );
    return result.data;
  }

  async listAdminSupportTickets(): Promise<SupportTicketView[]> {
    const result = await this.request(supportTicketListSchema, "/api/v1/admin/support/tickets", {
      method: "GET",
    });
    return result.data;
  }

  async assignSupportTicket(ticketId: string, assigneeId: string): Promise<SupportTicketView> {
    const result = await this.request(
      supportTicketViewSchema,
      `/api/v1/admin/support/tickets/${ticketId}/assign`,
      { method: "POST", body: JSON.stringify({ assigneeId }) },
    );
    return result.data;
  }

  async addSupportNote(ticketId: string, body: string): Promise<SupportNoteView> {
    const result = await this.request(
      supportNoteViewSchema,
      `/api/v1/admin/support/tickets/${ticketId}/notes`,
      { method: "POST", body: JSON.stringify({ body }) },
    );
    return result.data;
  }

  async escalateSupportTicket(
    ticketId: string,
    body: { toAssigneeId: string; reason: string },
  ): Promise<SupportEscalationView> {
    const result = await this.request(
      supportEscalationViewSchema,
      `/api/v1/admin/support/tickets/${ticketId}/escalate`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async patchSupportTicket(
    ticketId: string,
    body: {
      status?: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
      priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    },
  ): Promise<SupportTicketView> {
    const result = await this.request(
      supportTicketViewSchema,
      `/api/v1/admin/support/tickets/${ticketId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    return result.data;
  }

  async searchMembers(query: string): Promise<AdminMemberView[]> {
    const result = await this.request(
      adminMemberListSchema,
      `/api/v1/admin/members${toQuery({ q: query })}`,
      { method: "GET" },
    );
    return result.data;
  }

  async getAdminMember(memberId: string): Promise<AdminMemberDetail> {
    const result = await this.request(
      adminMemberDetailSchema,
      `/api/v1/admin/members/${memberId}`,
      {
        method: "GET",
      },
    );
    return result.data;
  }

  async suspendMember(memberId: string): Promise<AdminMemberDetail> {
    const result = await this.request(
      adminMemberDetailSchema,
      `/api/v1/admin/members/${memberId}/suspend`,
      { method: "POST" },
    );
    return result.data;
  }

  async restoreMember(memberId: string): Promise<AdminMemberDetail> {
    const result = await this.request(
      adminMemberDetailSchema,
      `/api/v1/admin/members/${memberId}/restore`,
      { method: "POST" },
    );
    return result.data;
  }

  async revokeMemberSessions(memberId: string): Promise<AdminMemberDetail> {
    const result = await this.request(
      adminMemberDetailSchema,
      `/api/v1/admin/members/${memberId}/sessions/revoke`,
      { method: "POST" },
    );
    return result.data;
  }

  async setMemberRoles(
    memberId: string,
    roles: Array<"MEMBER" | "ADMIN" | "SUPPORT_AGENT" | "MODERATOR">,
  ): Promise<AdminMemberDetail> {
    const result = await this.request(
      adminMemberDetailSchema,
      `/api/v1/admin/members/${memberId}/roles`,
      { method: "PATCH", body: JSON.stringify({ roles }) },
    );
    return result.data;
  }

  async listAdminProfessionals(): Promise<AdminProfessionalView[]> {
    const result = await this.request(adminProfessionalListSchema, "/api/v1/admin/professionals", {
      method: "GET",
    });
    return result.data;
  }

  async listAdminBusinesses(): Promise<AdminBusinessView[]> {
    const result = await this.request(adminBusinessListSchema, "/api/v1/admin/businesses", {
      method: "GET",
    });
    return result.data;
  }

  async listAudit(query: {
    entity?: string;
    actorId?: string;
    requestId?: string;
  }): Promise<AuditLogView[]> {
    const result = await this.request(auditLogListSchema, `/api/v1/admin/audit${toQuery(query)}`, {
      method: "GET",
    });
    return result.data;
  }

  async getThemeEditor(): Promise<ThemeEditorView> {
    const result = await this.request(themeEditorViewSchema, "/api/v1/admin/theme", {
      method: "GET",
    });
    return result.data;
  }

  async saveThemeDraft(tokens: ThemeTokens): Promise<ThemeEditorView> {
    const result = await this.request(themeEditorViewSchema, "/api/v1/admin/theme/draft", {
      method: "POST",
      body: JSON.stringify({ tokens }),
    });
    return result.data;
  }

  async publishTheme(): Promise<ThemeEditorView> {
    const result = await this.request(themeEditorViewSchema, "/api/v1/admin/theme/publish", {
      method: "POST",
    });
    return result.data;
  }

  async listAdminFlags(): Promise<FeatureFlagAdminView[]> {
    const result = await this.request(featureFlagAdminListSchema, "/api/v1/admin/flags", {
      method: "GET",
    });
    return result.data;
  }

  async updateAdminFlag(key: string, enabled: boolean): Promise<FeatureFlagAdminView> {
    const result = await this.request(
      featureFlagAdminViewSchema,
      `/api/v1/admin/flags/${encodeURIComponent(key)}`,
      { method: "PATCH", body: JSON.stringify({ enabled }) },
    );
    return result.data;
  }

  async listMyServices(): Promise<ServiceOfferingView[]> {
    const result = await this.request(serviceOfferingListSchema, "/api/v1/me/services", {
      method: "GET",
    });
    return result.data;
  }

  async createService(body: {
    categoryId: string;
    title: string;
    description?: string;
    displayPriceAmount?: number | null;
    displayCurrency?: string | null;
  }): Promise<ServiceOfferingView> {
    const result = await this.request(serviceOfferingViewSchema, "/api/v1/me/services", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async listProfessionalServices(professionalId: string): Promise<ServiceOfferingView[]> {
    const result = await this.request(
      serviceOfferingListSchema,
      `/api/v1/professionals/${professionalId}/services`,
      { method: "GET" },
    );
    return result.data;
  }

  async listReviews(
    subjectType: "PROFESSIONAL" | "BUSINESS",
    subjectId: string,
  ): Promise<ReviewView[]> {
    const result = await this.request(
      reviewListSchema,
      `/api/v1/reviews${toQuery({ subjectType, subjectId })}`,
      { method: "GET" },
    );
    return result.data;
  }

  async createReview(body: {
    subjectType: "PROFESSIONAL" | "BUSINESS";
    subjectId: string;
    rating: number;
    body?: string;
  }): Promise<ReviewView> {
    const result = await this.request(reviewViewSchema, "/api/v1/reviews", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async getReviewAggregate(
    subjectType: "PROFESSIONAL" | "BUSINESS",
    subjectId: string,
  ): Promise<{ avgRating: number; count: number }> {
    const result = await this.request(
      reviewAggregateViewSchema,
      `/api/v1/reviews/aggregate${toQuery({ subjectType, subjectId })}`,
      { method: "GET" },
    );
    return result.data;
  }

  async createStory(body: StoryCreateInput): Promise<StoryView> {
    const result = await this.request(storyViewSchema, "/api/v1/me/stories", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async storyComposerConfig(): Promise<StoryComposerConfig> {
    const result = await this.request(storyComposerConfigSchema, "/api/v1/stories/composer", {
      method: "GET",
    });
    return result.data;
  }

  async listAudioTracks(): Promise<AudioTrackView[]> {
    const result = await this.request(audioTrackListSchema, "/api/v1/stories/audio", {
      method: "GET",
    });
    return result.data;
  }

  async listMyStories(): Promise<StoryView[]> {
    const result = await this.request(storyListSchema, "/api/v1/me/stories", { method: "GET" });
    return result.data;
  }

  async listMemberStories(memberId: string): Promise<StoryView[]> {
    const result = await this.request(storyListSchema, `/api/v1/stories/${memberId}`, {
      method: "GET",
    });
    return result.data;
  }

  async getMyLive(): Promise<LiveSessionView | null> {
    const result = await this.request(livePresenceViewSchema, "/api/v1/me/live", {
      method: "GET",
    });
    return result.data.live;
  }

  async getMemberLive(memberId: string): Promise<LiveSessionView | null> {
    const result = await this.request(livePresenceViewSchema, `/api/v1/stories/${memberId}/live`, {
      method: "GET",
    });
    return result.data.live;
  }

  async startLive(
    body: { title?: string; audience?: StoryAudience } = {},
  ): Promise<LiveSessionView> {
    const result = await this.request(liveSessionViewSchema, "/api/v1/me/live", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async endLive(): Promise<LiveSessionView> {
    const result = await this.request(liveSessionViewSchema, "/api/v1/me/live/end", {
      method: "POST",
    });
    return result.data;
  }

  async listAdminStories(): Promise<StoryView[]> {
    const result = await this.request(storyListSchema, "/api/v1/admin/stories", { method: "GET" });
    return result.data;
  }

  async hideStory(storyId: string): Promise<StoryView> {
    const result = await this.request(storyViewSchema, `/api/v1/admin/stories/${storyId}/hide`, {
      method: "POST",
      body: JSON.stringify({ hidden: true }),
    });
    return result.data;
  }

  async listAdminLive(): Promise<LiveSessionView[]> {
    const result = await this.request(liveSessionListSchema, "/api/v1/admin/live", {
      method: "GET",
    });
    return result.data;
  }

  async endAdminLive(liveId: string): Promise<LiveSessionView> {
    const result = await this.request(liveSessionViewSchema, `/api/v1/admin/live/${liveId}/end`, {
      method: "POST",
    });
    return result.data;
  }

  async listAdminAudioTracks(): Promise<AudioTrackView[]> {
    const result = await this.request(audioTrackListSchema, "/api/v1/admin/stories/audio", {
      method: "GET",
    });
    return result.data;
  }

  async createAudioTrack(body: AudioTrackUpsertInput): Promise<AudioTrackView> {
    const result = await this.request(audioTrackViewSchema, "/api/v1/admin/stories/audio", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.data;
  }

  async setAudioTrackActive(trackId: string, isActive: boolean): Promise<AudioTrackView> {
    const result = await this.request(
      audioTrackViewSchema,
      `/api/v1/admin/stories/audio/${trackId}`,
      { method: "PATCH", body: JSON.stringify({ isActive }) },
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
