import {
  AUTH_POLICY_CONFIG_KEY,
  AUTH_POLICY_DEFAULTS,
  DEFAULT_THEME_TOKENS,
  DISCOVERY_POLICY_CONFIG_KEY,
  DISCOVERY_RANKING_DEFAULTS,
  MESSAGING_POLICY_CONFIG_KEY,
  REPORTS_POLICY_CONFIG_KEY,
  isMessagingPolicy,
  isReportsPolicy,
  readMessagingPolicy,
  readReportsPolicy,
  LOCATION_POLICY_CONFIG_KEY,
  MEDIA_POLICY_CONFIG_KEY,
  MEDIA_POLICY_DEFAULTS,
  PROFESSIONAL_AVAILABILITY_CONFIG_KEY,
  PROFESSIONAL_AVAILABILITY_DEFAULTS,
  isAuthPolicy,
  isAvailabilityOptions,
  isDiscoveryRankingWeights,
  isMediaPolicy,
  normalizeRankingWeights,
  readDiscoveryPolicy,
  readLocationPolicy,
  resolveMapTileChain,
  type ApiEnv,
  type AuthPolicy,
  type DiscoveryPolicy,
  type DiscoveryRankingWeights,
  type LocationPolicy,
  type MediaPolicy,
  type MessagingPolicy,
  type ProfessionalAvailabilityOption,
  type ReportsPolicy,
} from "@hasut/config";
import type {
  DiscoveryPolicyView,
  FeatureFlagAdminView,
  MessagingPolicyView,
  PublicFlagsConfig,
  PublicThemeConfig,
  ReportsPolicyView,
  ThemeEditorView,
  ThemeTokens,
} from "@hasut/types";
import type { Prisma } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class ConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnv, true>,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async getAuthPolicy(): Promise<AuthPolicy> {
    const row = await this.prisma.remoteConfig.findUnique({
      where: { key: AUTH_POLICY_CONFIG_KEY },
    });
    if (row !== null && isAuthPolicy(row.valueJson)) {
      return row.valueJson;
    }
    return AUTH_POLICY_DEFAULTS;
  }

  async getLocationPolicy(): Promise<LocationPolicy> {
    const row = await this.prisma.remoteConfig.findUnique({
      where: { key: LOCATION_POLICY_CONFIG_KEY },
    });
    return readLocationPolicy(row?.valueJson);
  }

  async getProfessionalAvailabilities(): Promise<ProfessionalAvailabilityOption[]> {
    const row = await this.prisma.remoteConfig.findUnique({
      where: { key: PROFESSIONAL_AVAILABILITY_CONFIG_KEY },
    });
    if (row !== null && isAvailabilityOptions(row.valueJson)) {
      return row.valueJson;
    }
    return PROFESSIONAL_AVAILABILITY_DEFAULTS;
  }

  async getMediaPolicy(): Promise<MediaPolicy> {
    const row = await this.prisma.remoteConfig.findUnique({
      where: { key: MEDIA_POLICY_CONFIG_KEY },
    });
    if (row !== null && isMediaPolicy(row.valueJson)) {
      return row.valueJson;
    }
    return MEDIA_POLICY_DEFAULTS;
  }

  async getMessagingPolicy(): Promise<MessagingPolicy> {
    const row = await this.prisma.remoteConfig.findUnique({
      where: { key: MESSAGING_POLICY_CONFIG_KEY },
    });
    if (row !== null && isMessagingPolicy(row.valueJson)) {
      return readMessagingPolicy(row.valueJson);
    }
    return readMessagingPolicy(null);
  }

  async getPublicMessagingPolicy(): Promise<MessagingPolicyView> {
    return this.getMessagingPolicy();
  }

  async getReportsPolicy(): Promise<ReportsPolicy> {
    const row = await this.prisma.remoteConfig.findUnique({
      where: { key: REPORTS_POLICY_CONFIG_KEY },
    });
    if (row !== null && isReportsPolicy(row.valueJson)) {
      return readReportsPolicy(row.valueJson);
    }
    return readReportsPolicy(null);
  }

  async getPublicReportsPolicy(): Promise<ReportsPolicyView> {
    return this.getReportsPolicy();
  }

  async getDiscoveryPolicy(): Promise<DiscoveryPolicy> {
    const row = await this.prisma.remoteConfig.findUnique({
      where: { key: DISCOVERY_POLICY_CONFIG_KEY },
    });
    return readDiscoveryPolicy(row?.valueJson);
  }

  async getPublicDiscoveryPolicy(): Promise<DiscoveryPolicyView> {
    const policy = await this.getDiscoveryPolicy();
    const location = await this.getLocationPolicy();
    const tiles = resolveMapTileChain({
      primary: policy.mapProvider,
      customTileUrl: policy.mapCustomTileUrl,
      maptilerApiKey: this.config.get("MAPTILER_API_KEY", { infer: true }),
      stadiaApiKey: this.config.get("STADIA_API_KEY", { infer: true }),
    });
    return {
      defaultRadiusMeters: policy.defaultRadiusMeters,
      minRadiusMeters: policy.minRadiusMeters,
      maxRadiusMeters: policy.maxRadiusMeters,
      radiusOptionsMeters: policy.radiusOptionsMeters,
      clusterCellMeters: policy.clusterCellMeters,
      includeMembers: policy.includeMembers,
      availableCodes: policy.availableCodes,
      availableModeCodes: policy.availableModeCodes,
      mapProvider: policy.mapProvider,
      mapCustomTileUrl: policy.mapCustomTileUrl,
      mapTileUrl: tiles.tileUrl,
      mapFallbackTileUrls: tiles.fallbackTileUrls,
      mapAttribution: tiles.attribution,
      demoLatitude: policy.demoLatitude,
      demoLongitude: policy.demoLongitude,
      minUpdateIntervalSeconds: location.minUpdateIntervalSeconds,
      significantMoveMeters: location.significantMoveMeters,
      geolocationTimeoutMs: location.geolocationTimeoutMs,
      searchDebounceMs: policy.searchDebounceMs,
    };
  }

  async updateDiscoveryPolicy(
    patch: Partial<DiscoveryPolicy> & { mapTileUrl?: string },
  ): Promise<DiscoveryPolicy> {
    const current = await this.getDiscoveryPolicy();
    const mapCustomTileUrl =
      patch.mapCustomTileUrl !== undefined
        ? patch.mapCustomTileUrl
        : patch.mapTileUrl !== undefined
          ? patch.mapTileUrl
          : current.mapCustomTileUrl;
    const next = readDiscoveryPolicy({
      ...current,
      ...patch,
      mapCustomTileUrl,
    });
    await this.prisma.remoteConfig.upsert({
      where: { key: DISCOVERY_POLICY_CONFIG_KEY },
      create: {
        key: DISCOVERY_POLICY_CONFIG_KEY,
        valueJson: next as unknown as Prisma.InputJsonValue,
        environment: "all",
      },
      update: { valueJson: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  async getDiscoveryRankingWeights(): Promise<DiscoveryRankingWeights> {
    const row = await this.prisma.discoveryRankingWeights.findFirst({ where: { active: true } });
    if (row === null) {
      return DISCOVERY_RANKING_DEFAULTS;
    }
    const weights = {
      distance: row.distance,
      categoryRelevance: row.categoryRelevance,
      availability: row.availability,
      verification: row.verification,
      rating: row.rating,
      activity: row.activity,
    };
    return isDiscoveryRankingWeights(weights)
      ? normalizeRankingWeights(weights)
      : DISCOVERY_RANKING_DEFAULTS;
  }

  async updateDiscoveryRankingWeights(
    weights: DiscoveryRankingWeights,
  ): Promise<DiscoveryRankingWeights> {
    const normalized = normalizeRankingWeights(weights);
    await this.prisma.$transaction([
      this.prisma.discoveryRankingWeights.updateMany({ data: { active: false } }),
      this.prisma.discoveryRankingWeights.create({
        data: { ...normalized, active: true },
      }),
    ]);
    return normalized;
  }

  async getPublicTheme(): Promise<PublicThemeConfig> {
    const published = await this.prisma.themeConfig.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { version: "desc" },
    });
    if (published === null) {
      return { version: 1, tokens: DEFAULT_THEME_TOKENS, logoUrl: null };
    }
    return {
      version: published.version,
      tokens: published.tokensJson as ThemeTokens,
      logoUrl: null,
    };
  }

  async getPublicFlags(): Promise<PublicFlagsConfig> {
    const rows = await this.prisma.featureFlag.findMany();
    const flags: Record<string, boolean> = {};
    for (const row of rows) {
      flags[row.key] = row.enabled;
    }
    return { flags };
  }

  async listFlags(): Promise<FeatureFlagAdminView[]> {
    const rows = await this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
    return rows.map((row) => ({
      key: row.key,
      enabled: row.enabled,
      description: row.description,
    }));
  }

  async updateFlag(
    actorId: string,
    key: string,
    enabled: boolean,
    requestId: string,
  ): Promise<FeatureFlagAdminView> {
    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled },
    });
    await this.audit.record({
      actorId,
      action: "FEATURE_FLAG_UPDATED",
      entity: "feature_flag",
      entityId: key,
      requestId,
      afterJson: { enabled },
    });
    return { key: updated.key, enabled: updated.enabled, description: updated.description };
  }

  async getThemeEditor(): Promise<ThemeEditorView> {
    const row =
      (await this.prisma.themeConfig.findFirst({
        where: { status: "DRAFT" },
        orderBy: { version: "desc" },
      })) ??
      (await this.prisma.themeConfig.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
      }));
    const tokens = (row?.tokensJson as ThemeTokens | undefined) ?? DEFAULT_THEME_TOKENS;
    return {
      version: row?.version ?? 1,
      status: row?.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
      tokens,
      logoUrl: null,
      contrastWarnings: contrastWarnings(tokens),
    };
  }

  async saveThemeDraft(
    actorId: string,
    tokens: ThemeTokens,
    requestId: string,
  ): Promise<ThemeEditorView> {
    const latest = await this.prisma.themeConfig.findFirst({ orderBy: { version: "desc" } });
    const version = (latest?.version ?? 0) + 1;
    await this.prisma.themeConfig.create({
      data: { version, status: "DRAFT", tokensJson: tokens as unknown as Prisma.InputJsonValue },
    });
    await this.audit.record({
      actorId,
      action: "THEME_DRAFT_SAVED",
      entity: "theme_config",
      entityId: String(version),
      requestId,
    });
    return this.getThemeEditor();
  }

  async publishTheme(actorId: string, requestId: string): Promise<ThemeEditorView> {
    const draft = await this.prisma.themeConfig.findFirst({
      where: { status: "DRAFT" },
      orderBy: { version: "desc" },
    });
    const source =
      draft ??
      (await this.prisma.themeConfig.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
      }));
    const tokens = (source?.tokensJson as ThemeTokens | undefined) ?? DEFAULT_THEME_TOKENS;
    const version = (source?.version ?? 0) + (draft === null ? 1 : 0);
    await this.prisma.$transaction([
      this.prisma.themeConfig.updateMany({
        data: { status: "DRAFT" },
        where: { status: "PUBLISHED" },
      }),
      draft === null
        ? this.prisma.themeConfig.create({
            data: {
              version: version + 1,
              status: "PUBLISHED",
              tokensJson: tokens as unknown as Prisma.InputJsonValue,
              publishedAt: new Date(),
            },
          })
        : this.prisma.themeConfig.update({
            where: { id: draft.id },
            data: { status: "PUBLISHED", publishedAt: new Date() },
          }),
    ]);
    await this.redis.del("theme:published");
    await this.audit.record({
      actorId,
      action: "THEME_PUBLISH",
      entity: "theme_config",
      entityId: draft?.id ?? "published",
      requestId,
      afterJson: { warnings: contrastWarnings(tokens).length },
    });
    return this.getThemeEditor();
  }
}

function contrastWarnings(tokens: ThemeTokens): string[] {
  const warnings: string[] = [];
  if (contrastRatio(tokens.primary, tokens.textOnPrimary) < 4.5) {
    warnings.push("Primary and text-on-primary may fail contrast.");
  }
  if (contrastRatio(tokens.background, tokens.text) < 4.5) {
    warnings.push("Background and text may fail contrast.");
  }
  return warnings;
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(value: string): number {
  const hex = value.startsWith("#") ? value.slice(1) : "ffffff";
  if (hex.length < 6) {
    return 1;
  }
  const r = channel(Number.parseInt(hex.slice(0, 2), 16) / 255);
  const g = channel(Number.parseInt(hex.slice(2, 4), 16) / 255);
  const b = channel(Number.parseInt(hex.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
