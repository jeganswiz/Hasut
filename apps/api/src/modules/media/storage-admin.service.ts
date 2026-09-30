import {
  STORAGE_PROVIDER_CATALOG,
  type StorageOverview,
  type StorageSwitchResult,
} from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { StorageProfile } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageProbeError } from "./storage/local-media.storage";
import { StorageRegistry } from "./storage/storage-registry.service";
import { decideStorageSwitch } from "./storage/storage-transfer";
import {
  accessKeyHint,
  fromPrismaProvider,
  samePhysicalStore,
  type StorageConnection,
} from "./storage/storage-url";
import { StorageMigrationService } from "./storage-migration.service";

export interface StorageSwitchInput {
  provider: StorageConnection["provider"];
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle?: boolean;
  publicBaseUrl: string;
  localRoot: string;
  migrate?: boolean;
}

@Injectable()
export class StorageAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StorageRegistry,
    private readonly migration: StorageMigrationService,
    private readonly audit: AuditService,
  ) {}

  overview(): Promise<StorageOverview> {
    return this.loadOverview();
  }

  async switchTo(
    actorId: string,
    input: StorageSwitchInput,
    requestId: string,
  ): Promise<StorageSwitchResult> {
    const running = await this.prisma.storageMigration.findFirst({
      where: { status: { in: ["RUNNING", "PENDING"] } },
    });
    if (running !== null) {
      throw new HasutHttpException(
        "CONFLICT",
        "A storage transfer is already running",
        HttpStatus.CONFLICT,
      );
    }
    const active = await this.registry.ensureActive();
    const draft = this.registry.draftConnection(input);
    try {
      await this.registry.probe(draft);
    } catch (error) {
      if (error instanceof StorageProbeError) {
        throw new HasutHttpException("VALIDATION_ERROR", error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Could not reach that storage. Check the endpoint, bucket, region, and keys.",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (samePhysicalStore(active, draft)) {
      const saved = await this.registry.insertProfile(draft, false);
      await this.prisma.mediaAsset.updateMany({
        where: { storageProfileId: active.id },
        data: { storageProfileId: saved.id, bucket: saved.bucket },
      });
      await this.registry.activate(saved.id);
      await this.audit.record({
        actorId,
        action: "STORAGE_SWITCHED",
        entity: "storage_profile",
        entityId: saved.id,
        requestId,
        afterJson: { provider: saved.provider, bucket: saved.bucket, migrated: false },
      });
      return {
        outcome: "switched",
        overview: await this.loadOverview(),
        pendingAssetCount: 0,
        pendingBytes: 0,
      };
    }
    const movable = await this.migration.snapshot(active.id);
    const decision = decideStorageSwitch({
      movableCount: movable.count,
      migrate: input.migrate,
    });
    if (decision === "confirm") {
      return {
        outcome: "confirmation_required",
        overview: await this.loadOverview(),
        pendingAssetCount: movable.count,
        pendingBytes: movable.bytes,
      };
    }
    const saved = await this.registry.insertProfile(draft, false);
    if (decision === "switch") {
      await this.registry.activate(saved.id);
      await this.audit.record({
        actorId,
        action: "STORAGE_SWITCHED",
        entity: "storage_profile",
        entityId: saved.id,
        requestId,
        afterJson: { provider: saved.provider, bucket: saved.bucket, migrated: false },
      });
      return {
        outcome: "switched",
        overview: await this.loadOverview(),
        pendingAssetCount: movable.count,
        pendingBytes: movable.bytes,
      };
    }
    await this.migration.start(actorId, requestId, active, saved, movable.files);
    return {
      outcome: "migration_started",
      overview: await this.loadOverview(),
      pendingAssetCount: movable.count,
      pendingBytes: movable.bytes,
    };
  }

  async cancel(actorId: string, migrationId: string, requestId: string): Promise<StorageOverview> {
    await this.migration.cancel(actorId, migrationId, requestId);
    return this.loadOverview();
  }

  async retry(actorId: string, migrationId: string, requestId: string): Promise<StorageOverview> {
    await this.migration.retry(actorId, migrationId, requestId);
    return this.loadOverview();
  }

  private async loadOverview(): Promise<StorageOverview> {
    await this.registry.ensureActive();
    const profiles = await this.prisma.storageProfile.findMany({ orderBy: { createdAt: "desc" } });
    const counts = await this.prisma.mediaAsset.groupBy({
      by: ["storageProfileId"],
      where: { status: "READY", storageProfileId: { not: null } },
      _count: { _all: true },
    });
    const countByProfile = new Map(counts.map((row) => [row.storageProfileId, row._count._all]));
    const views = [];
    for (const profile of profiles) {
      views.push(await this.toProfileView(profile, countByProfile.get(profile.id) ?? 0));
    }
    const active = views.find((profile) => profile.isActive);
    if (active === undefined) {
      throw new HasutHttpException(
        "INTERNAL_ERROR",
        "No active storage is configured",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return {
      active,
      profiles: views,
      providers: [...STORAGE_PROVIDER_CATALOG],
      migration: await this.latestMigration(),
    };
  }

  private async toProfileView(profile: StorageProfile, readyAssetCount: number) {
    const connection = await this.registry.connectionById(profile.id);
    return {
      id: profile.id,
      provider: connection.provider,
      label: profile.label,
      endpoint: profile.endpoint,
      region: profile.region,
      bucket: profile.bucket,
      forcePathStyle: profile.forcePathStyle,
      publicBaseUrl: profile.publicBaseUrl,
      localRoot: profile.localRoot,
      accessKeyHint: accessKeyHint(connection.accessKey),
      secretConfigured: connection.secretKey.length > 0,
      isActive: profile.isActive,
      readyAssetCount,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  private async latestMigration() {
    const running = await this.prisma.storageMigration.findFirst({
      where: { status: { in: ["RUNNING", "PENDING"] } },
      orderBy: { createdAt: "desc" },
      include: { fromProfile: true, toProfile: true },
    });
    const migration =
      running ??
      (await this.prisma.storageMigration.findFirst({
        orderBy: { createdAt: "desc" },
        include: { fromProfile: true, toProfile: true },
      }));
    if (migration === null) {
      return null;
    }
    const items = await this.prisma.storageMigrationItem.findMany({
      where: { migrationId: migration.id },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    return {
      id: migration.id,
      status: migration.status,
      fromLabel: migration.fromProfile.label,
      toLabel: migration.toProfile.label,
      fromProvider: fromPrismaProvider(migration.fromProfile.provider),
      toProvider: fromPrismaProvider(migration.toProfile.provider),
      totalCount: migration.totalCount,
      copiedCount: migration.copiedCount,
      failedCount: migration.failedCount,
      skippedCount: migration.skippedCount,
      errorMessage: migration.errorMessage,
      startedAt: migration.startedAt?.toISOString() ?? null,
      finishedAt: migration.finishedAt?.toISOString() ?? null,
      items: items.map((item) => ({
        id: item.id,
        objectKey: item.objectKey,
        status: item.status,
        byteSize: item.byteSize,
        errorMessage: item.errorMessage,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }
}
