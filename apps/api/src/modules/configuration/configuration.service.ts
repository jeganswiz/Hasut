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
  MessagingPolicyView,
  PublicFlagsConfig,
  PublicThemeConfig,
  ReportsPolicyView,
  ThemeTokens,
} from "@hasut/types";
import type { Prisma } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

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
    return {
      defaultRadiusMeters: policy.defaultRadiusMeters,
      minRadiusMeters: policy.minRadiusMeters,
      maxRadiusMeters: policy.maxRadiusMeters,
      radiusOptionsMeters: policy.radiusOptionsMeters,
      clusterCellMeters: policy.clusterCellMeters,
      includeMembers: policy.includeMembers,
      availableCodes: policy.availableCodes,
      availableModeCodes: policy.availableModeCodes,
      mapTileUrl: policy.mapTileUrl,
      demoLatitude: policy.demoLatitude,
      demoLongitude: policy.demoLongitude,
    };
  }

  async updateDiscoveryPolicy(patch: Partial<DiscoveryPolicy>): Promise<DiscoveryPolicy> {
    const current = await this.getDiscoveryPolicy();
    const next = readDiscoveryPolicy({ ...current, ...patch });
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
      return { version: 1, tokens: DEFAULT_THEME_TOKENS };
    }
    return {
      version: published.version,
      tokens: published.tokensJson as ThemeTokens,
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
}
