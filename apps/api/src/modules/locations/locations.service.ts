import type {
  ApproximateLocation,
  DiscoveryPresenceUpdated,
  LocationPermission,
  OwnerLocation,
} from "@hasut/types";
import { DISCOVERY_PRESENCE_EVENT } from "@hasut/types";
import { cellNeighborhood, haversineMeters, isValidWgs84, snapToGrid } from "@hasut/utils";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEvents } from "../realtime/realtime.events";
import { buildMemberPresenceMarker } from "../discovery/presence-payload";
import { REVERSE_GEOCODER, type ReverseGeocoder } from "./geocoder/reverse-geocoder";
import { LocationsRepository } from "./locations.repository";

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: LocationsRepository,
    private readonly configuration: ConfigurationService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeEvents,
    @Inject(REVERSE_GEOCODER) private readonly geocoder: ReverseGeocoder,
  ) {}

  async getOwnerLocation(memberId: string): Promise<OwnerLocation> {
    const row = await this.prisma.memberLocation.findUnique({ where: { memberId } });
    const approximate = await this.getApproximateLocation(memberId);
    if (row === null) {
      return { permission: "PROMPT", exact: null, approximate };
    }
    const exactPoint = await this.repository.readExactPoint(memberId);
    return {
      permission: row.permission,
      exact:
        exactPoint === null
          ? null
          : {
              latitude: exactPoint.latitude,
              longitude: exactPoint.longitude,
              accuracyMeters: row.accuracyMeters,
              updatedAt: row.updatedAt.toISOString(),
            },
      approximate,
    };
  }

  async getApproximateLocation(memberId: string): Promise<ApproximateLocation | null> {
    const row = await this.prisma.memberPublicLocation.findUnique({ where: { memberId } });
    if (row === null) {
      return null;
    }
    return {
      label: row.label,
      city: row.city,
      region: row.region,
      country: row.country,
      countryCode: row.countryCode,
    };
  }

  async setPermission(
    memberId: string,
    status: LocationPermission,
    requestId: string,
  ): Promise<OwnerLocation> {
    await this.prisma.memberLocation.upsert({
      where: { memberId },
      create: { memberId, permission: status },
      update: { permission: status },
    });
    await this.audit.record({
      actorId: memberId,
      action: "LOCATION_PERMISSION_CHANGED",
      entity: "member_location",
      entityId: memberId,
      requestId,
      afterJson: { permission: status },
    });
    return this.getOwnerLocation(memberId);
  }

  async updateExactLocation(
    memberId: string,
    input: { latitude: number; longitude: number; accuracyMeters?: number },
    requestId: string,
  ): Promise<OwnerLocation> {
    if (!isValidWgs84(input.latitude, input.longitude)) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Coordinates are invalid",
        HttpStatus.BAD_REQUEST,
      );
    }

    const policy = await this.configuration.getLocationPolicy();
    const existing = await this.prisma.memberLocation.findUnique({ where: { memberId } });
    if (existing === null || existing.permission !== "GRANTED") {
      throw new HasutHttpException(
        "LOCATION_PERMISSION_DENIED",
        "Location permission must be granted before updating location",
        HttpStatus.FORBIDDEN,
      );
    }

    const previousExact = await this.repository.readExactPoint(memberId);
    if (previousExact !== null) {
      const movedMeters = haversineMeters(previousExact, {
        latitude: input.latitude,
        longitude: input.longitude,
      });
      if (movedMeters < policy.significantMoveMeters) {
        return this.getOwnerLocation(memberId);
      }
      const elapsedMs = Date.now() - existing.updatedAt.getTime();
      if (elapsedMs < policy.minUpdateIntervalSeconds * 1000) {
        throw new HasutHttpException(
          "RATE_LIMITED",
          "Location was updated too recently",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.prisma.memberLocation.update({
      where: { memberId },
      data: {
        accuracyMeters: input.accuracyMeters ?? null,
        permission: "GRANTED",
      },
    });
    await this.repository.writeExactPoint(memberId, input.longitude, input.latitude);

    const snapped = snapToGrid(
      { latitude: input.latitude, longitude: input.longitude },
      policy.cellSizeMeters,
    );
    const resolved = (await this.geocoder.reverse({
      latitude: snapped.latitude,
      longitude: snapped.longitude,
    })) ?? {
      label: "Approximate area",
      city: null,
      region: null,
      country: null,
      countryCode: null,
    };

    await this.prisma.memberPublicLocation.upsert({
      where: { memberId },
      create: {
        memberId,
        label: resolved.label,
        city: resolved.city,
        region: resolved.region,
        country: resolved.country,
        countryCode: resolved.countryCode,
        cellId: snapped.cellId,
      },
      update: {
        label: resolved.label,
        city: resolved.city,
        region: resolved.region,
        country: resolved.country,
        countryCode: resolved.countryCode,
        cellId: snapped.cellId,
      },
    });
    await this.repository.writeApproximatePoint(memberId, snapped.longitude, snapped.latitude);

    await this.audit.record({
      actorId: memberId,
      action: "LOCATION_UPDATED",
      entity: "member_location",
      entityId: memberId,
      requestId,
      afterJson: {
        cellId: snapped.cellId,
        city: resolved.city,
        country: resolved.country,
      },
    });

    await this.publishPresence(memberId, previousExact, {
      latitude: input.latitude,
      longitude: input.longitude,
    });

    return this.getOwnerLocation(memberId);
  }

  private async publishPresence(
    memberId: string,
    previousExact: { latitude: number; longitude: number } | null,
    next: { latitude: number; longitude: number },
  ): Promise<void> {
    const locationPolicy = await this.configuration.getLocationPolicy();
    const discoveryPolicy = await this.configuration.getDiscoveryPolicy();
    const snapped = snapToGrid(next, locationPolicy.cellSizeMeters);
    const profile = await this.prisma.profile.findUnique({
      where: { memberId },
      select: { displayName: true },
    });
    const payload: DiscoveryPresenceUpdated = {
      marker: buildMemberPresenceMarker({
        memberId,
        displayName: profile?.displayName ?? "",
        pinLat: snapped.latitude,
        pinLng: snapped.longitude,
        rating: null,
      }),
    };
    const cellIds = new Set(
      cellNeighborhood(next, locationPolicy.cellSizeMeters, discoveryPolicy.defaultRadiusMeters),
    );
    if (previousExact !== null) {
      for (const id of cellNeighborhood(
        previousExact,
        locationPolicy.cellSizeMeters,
        discoveryPolicy.defaultRadiusMeters,
      )) {
        cellIds.add(id);
      }
    }
    this.realtime.publishCells([...cellIds], DISCOVERY_PRESENCE_EVENT, payload);
  }

  hasStoredLocation(memberId: string): Promise<boolean> {
    return this.prisma.memberPublicLocation
      .findUnique({ where: { memberId } })
      .then((row) => row !== null);
  }
}
