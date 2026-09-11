import type {
  DiscoveryCard,
  DiscoveryCluster,
  DiscoveryKind,
  DiscoveryMarker,
  DiscoveryPolicyView,
  DiscoveryPreview,
  DiscoveryResult,
} from "@hasut/types";
import { isValidWgs84, snapToGrid } from "@hasut/utils";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConfigurationService } from "../configuration/configuration.service";
import { LocationsRepository } from "../locations/locations.repository";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { clusterRanked, rankNearbyRows, type RankedNearby } from "./discovery.ranking";
import { DiscoveryRepository, type NearbyRow } from "./discovery.repository";

export interface DiscoveryQuery {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  kinds?: DiscoveryKind[];
  categoryId?: string;
  verified?: boolean;
  available?: boolean;
  q?: string;
}

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly repository: DiscoveryRepository,
    private readonly configuration: ConfigurationService,
    private readonly locations: LocationsRepository,
    private readonly media: MediaService,
    private readonly prisma: PrismaService,
  ) {}

  async nearby(viewerId: string | null, query: DiscoveryQuery): Promise<DiscoveryResult> {
    const collected = await this.collect(viewerId, query);
    const items = await Promise.all(collected.display.map((row) => this.toCard(row)));
    const clusters = clusterRanked(collected.display, collected.policy.clusterCellMeters).map(
      (cluster): DiscoveryCluster => ({
        id: cluster.cellId,
        pinLat: cluster.pinLat,
        pinLng: cluster.pinLng,
        count: cluster.count,
        kinds: cluster.kinds,
      }),
    );
    const markers = collected.display.map((row): DiscoveryMarker => ({
      id: row.id,
      kind: row.kind,
      label: row.title,
      rating: row.rating,
      selected: false,
      pinLat: row.pinLat,
      pinLng: row.pinLng,
    }));

    return {
      originLabel: collected.origin.label,
      radiusMeters: collected.radiusMeters,
      items,
      markers,
      clusters,
    };
  }

  async search(viewerId: string | null, query: DiscoveryQuery): Promise<DiscoveryResult> {
    if (query.q === undefined || query.q.trim().length === 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Search text is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.nearby(viewerId, query);
  }

  async preview(
    viewerId: string | null,
    kind: DiscoveryKind,
    id: string,
    query: DiscoveryQuery,
  ): Promise<DiscoveryPreview> {
    const collected = await this.collect(viewerId, { ...query, kinds: [kind] });
    const row = collected.display.find((item) => item.id === id && item.kind === kind);
    if (row === undefined) {
      throw new HasutHttpException("NOT_FOUND", "Nearby result not found", HttpStatus.NOT_FOUND);
    }
    const card = await this.toCard(row);
    return {
      id: card.id,
      kind: card.kind,
      title: card.title,
      subtitle: card.subtitle,
      bio: card.subtitle,
      photoUrl: card.photoUrl,
      categoryLabels: card.categoryLabel === null ? [] : [card.categoryLabel],
      rating: card.rating,
      reviewCount: card.reviewCount,
      distanceBucket: card.distanceBucket,
      verified: card.verified,
      available: card.available,
      approximateLocation:
        row.locationLabel === null
          ? null
          : {
              label: row.locationLabel,
              city: row.city,
              region: row.region,
              country: row.country,
              countryCode: row.countryCode,
            },
      href: card.href,
    };
  }

  async publicPolicy(): Promise<DiscoveryPolicyView> {
    return this.configuration.getPublicDiscoveryPolicy();
  }

  private async collect(
    viewerId: string | null,
    query: DiscoveryQuery,
  ): Promise<{
    origin: { latitude: number; longitude: number; label: string | null };
    radiusMeters: number;
    policy: Awaited<ReturnType<ConfigurationService["getDiscoveryPolicy"]>>;
    display: RankedNearby[];
  }> {
    const policy = await this.configuration.getDiscoveryPolicy();
    const weights = await this.configuration.getDiscoveryRankingWeights();
    const locationPolicy = await this.configuration.getLocationPolicy();
    const origin = await this.resolveOrigin(viewerId, query);
    const radiusMeters = this.clampRadius(query.radiusMeters ?? policy.defaultRadiusMeters, policy);
    const kinds = this.resolveKinds(query.kinds, policy.includeMembers);
    const categoryFamily = await this.categoryFamily(query.categoryId);
    const search = query.q === undefined || query.q.trim().length === 0 ? null : query.q.trim();

    const collected: NearbyRow[] = [];
    if (kinds.includes("MEMBER")) {
      collected.push(
        ...(await this.repository.findNearbyMembers({
          longitude: origin.longitude,
          latitude: origin.latitude,
          radiusMeters,
          viewerId,
          query: search,
        })),
      );
    }
    if (kinds.includes("PROFESSIONAL")) {
      collected.push(
        ...(await this.repository.findNearbyProfessionals({
          longitude: origin.longitude,
          latitude: origin.latitude,
          radiusMeters,
          viewerId,
          query: search,
          match: policy.professionalMatch,
        })),
      );
    }
    if (kinds.includes("BUSINESS")) {
      collected.push(
        ...(await this.repository.findNearbyBusinesses({
          longitude: origin.longitude,
          latitude: origin.latitude,
          radiusMeters,
          query: search,
        })),
      );
    }

    let ranked = rankNearbyRows(collected, {
      weights,
      policy,
      radiusMeters,
      categoryId: query.categoryId,
      categoryFamily,
    });
    if (query.categoryId !== undefined) {
      ranked = ranked.filter((row) =>
        row.categoryIds.some((id) => categoryFamily?.has(id) === true),
      );
    }
    if (query.verified === true) {
      ranked = ranked.filter((row) => row.verified);
    }
    if (query.available === true) {
      ranked = ranked.filter((row) => row.available);
    }

    return {
      origin,
      radiusMeters,
      policy,
      display: ranked.map((row) => this.withPublicPin(row, locationPolicy.cellSizeMeters)),
    };
  }

  private async resolveOrigin(
    viewerId: string | null,
    query: DiscoveryQuery,
  ): Promise<{ latitude: number; longitude: number; label: string | null }> {
    if (query.latitude !== undefined && query.longitude !== undefined) {
      if (!isValidWgs84(query.latitude, query.longitude)) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Coordinates are invalid",
          HttpStatus.BAD_REQUEST,
        );
      }
      return { latitude: query.latitude, longitude: query.longitude, label: null };
    }
    if (viewerId !== null) {
      const stored = await this.locations.readExactPoint(viewerId);
      if (stored !== null) {
        const publicLocation = await this.prisma.memberPublicLocation.findUnique({
          where: { memberId: viewerId },
        });
        return {
          latitude: stored.latitude,
          longitude: stored.longitude,
          label: publicLocation?.label ?? null,
        };
      }
    }
    throw new HasutHttpException(
      "LOCATION_UNAVAILABLE",
      "Location is required to discover nearby people",
      HttpStatus.BAD_REQUEST,
    );
  }

  private clampRadius(
    radiusMeters: number,
    policy: { minRadiusMeters: number; maxRadiusMeters: number },
  ): number {
    return Math.min(policy.maxRadiusMeters, Math.max(policy.minRadiusMeters, radiusMeters));
  }

  private resolveKinds(
    kinds: DiscoveryKind[] | undefined,
    includeMembers: boolean,
  ): DiscoveryKind[] {
    const requested: DiscoveryKind[] =
      kinds === undefined || kinds.length === 0 ? ["PROFESSIONAL", "BUSINESS", "MEMBER"] : kinds;
    return includeMembers ? requested : requested.filter((kind) => kind !== "MEMBER");
  }

  private async categoryFamily(categoryId?: string): Promise<Set<string> | undefined> {
    if (categoryId === undefined) {
      return undefined;
    }
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ id: categoryId }, { parentId: categoryId }] },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  private withPublicPin(row: RankedNearby, cellSizeMeters: number): RankedNearby {
    if (row.kind === "BUSINESS") {
      return row;
    }
    const snapped = snapToGrid({ latitude: row.pinLat, longitude: row.pinLng }, cellSizeMeters);
    return { ...row, pinLat: snapped.latitude, pinLng: snapped.longitude };
  }

  private async toCard(row: RankedNearby): Promise<DiscoveryCard> {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      subtitle: row.subtitle,
      photoUrl: await this.media.photoUrl(row.photoMediaId),
      categoryLabel: row.categoryLabel,
      rating: row.rating,
      reviewCount: row.reviewCount,
      distanceBucket: row.distanceBucket,
      verified: row.verified,
      available: row.available,
      href: hrefFor(row.kind, row.id),
    };
  }
}

export function hrefFor(kind: DiscoveryKind, id: string): string {
  if (kind === "MEMBER") {
    return `/members/${id}`;
  }
  if (kind === "PROFESSIONAL") {
    return `/professionals/${id}`;
  }
  return `/businesses/${id}`;
}
