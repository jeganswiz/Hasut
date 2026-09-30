import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { StorageMigrationItem } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { assertObjectKey } from "./storage/storage-key";
import { StorageRegistry } from "./storage/storage-registry.service";
import { transferObject } from "./storage/storage-transfer";
import { publicObjectUrl, type StorageConnection } from "./storage/storage-url";

export interface MovableFile {
  mediaAssetId: string | null;
  objectKey: string;
  byteSize: number;
  mimeType: string;
}

export interface MovableSnapshot {
  count: number;
  bytes: number;
  files: MovableFile[];
}

@Injectable()
export class StorageMigrationService {
  private readonly logger = new Logger(StorageMigrationService.name);
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StorageRegistry,
    private readonly audit: AuditService,
  ) {}

  async snapshot(profileId: string): Promise<MovableSnapshot> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { storageProfileId: profileId },
    });
    const ready = assets.filter((asset) => asset.status === "READY");
    const blocked = new Set(
      assets.filter((asset) => asset.status !== "READY").map((asset) => asset.objectKey),
    );
    const listed = await this.registry.listProfile(profileId);
    const files: MovableFile[] = [];
    const seen = new Set<string>();
    for (const asset of ready) {
      if (seen.has(asset.objectKey)) {
        continue;
      }
      seen.add(asset.objectKey);
      files.push({
        mediaAssetId: asset.id,
        objectKey: asset.objectKey,
        byteSize: asset.byteSize,
        mimeType: asset.mimeType,
      });
    }
    for (const entry of listed) {
      if (seen.has(entry.key) || blocked.has(entry.key)) {
        continue;
      }
      try {
        assertObjectKey(entry.key);
      } catch {
        continue;
      }
      seen.add(entry.key);
      files.push({
        mediaAssetId: null,
        objectKey: entry.key,
        byteSize: entry.size,
        mimeType: "",
      });
    }
    return {
      count: files.length,
      bytes: files.reduce((sum, file) => sum + file.byteSize, 0),
      files,
    };
  }

  async start(
    actorId: string,
    requestId: string,
    source: StorageConnection,
    destination: StorageConnection,
    files: MovableFile[],
  ): Promise<void> {
    const migration = await this.prisma.storageMigration.create({
      data: {
        fromProfileId: source.id,
        toProfileId: destination.id,
        actorId,
        status: "RUNNING",
        totalCount: files.length,
        startedAt: new Date(),
        items: {
          create: files.map((file) => ({
            mediaAssetId: file.mediaAssetId,
            objectKey: file.objectKey,
            byteSize: file.byteSize,
          })),
        },
      },
    });
    await this.audit.record({
      actorId,
      action: "STORAGE_MIGRATION_STARTED",
      entity: "storage_migration",
      entityId: migration.id,
      requestId,
      afterJson: {
        from: source.provider,
        to: destination.provider,
        files: files.length,
      },
    });
  }

  async cancel(actorId: string, migrationId: string, requestId: string): Promise<void> {
    const migration = await this.requireMigration(migrationId);
    if (migration.status !== "RUNNING" && migration.status !== "PENDING") {
      throw new HasutHttpException("CONFLICT", "That transfer is not running", HttpStatus.CONFLICT);
    }
    await this.prisma.storageMigration.update({
      where: { id: migration.id },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      action: "STORAGE_MIGRATION_CANCELLED",
      entity: "storage_migration",
      entityId: migration.id,
      requestId,
      afterJson: { copied: migration.copiedCount, failed: migration.failedCount },
    });
  }

  async retry(actorId: string, migrationId: string, requestId: string): Promise<void> {
    const migration = await this.requireMigration(migrationId);
    if (migration.status !== "FAILED" && migration.status !== "CANCELLED") {
      throw new HasutHttpException(
        "CONFLICT",
        "That transfer cannot be resumed",
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.storageMigrationItem.updateMany({
      where: { migrationId: migration.id, status: "FAILED" },
      data: { status: "PENDING", errorMessage: "" },
    });
    await this.prisma.storageMigration.update({
      where: { id: migration.id },
      data: { status: "RUNNING", failedCount: 0, finishedAt: null, errorMessage: "" },
    });
    await this.audit.record({
      actorId,
      action: "STORAGE_MIGRATION_RETRIED",
      entity: "storage_migration",
      entityId: migration.id,
      requestId,
    });
  }

  async processBatch(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    try {
      const migration = await this.prisma.storageMigration.findFirst({
        where: { status: "RUNNING" },
        orderBy: { createdAt: "asc" },
      });
      if (migration === null) {
        return;
      }
      const items = await this.prisma.storageMigrationItem.findMany({
        where: { migrationId: migration.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 5,
      });
      for (const item of items) {
        await this.processItem(migration.fromProfileId, migration.toProfileId, item);
      }
      await this.drain(migration.id);
    } catch (error) {
      this.logger.warn(
        `Storage migration tick failed: ${error instanceof Error ? error.name : "error"}`,
      );
    } finally {
      this.busy = false;
    }
  }

  private async processItem(
    fromProfileId: string,
    toProfileId: string,
    item: StorageMigrationItem,
  ): Promise<void> {
    const current = await this.prisma.storageMigrationItem.findUnique({ where: { id: item.id } });
    if (current === null || current.status !== "PENDING") {
      return;
    }
    const parent = await this.prisma.storageMigration.findUnique({
      where: { id: item.migrationId },
      select: { status: true },
    });
    if (parent?.status !== "RUNNING") {
      return;
    }
    const source = await this.registry.driverForProfile(fromProfileId);
    const destinationDriver = await this.registry.driverForProfile(toProfileId);
    const destination = await this.registry.connectionById(toProfileId);
    let mimeType = "";
    if (item.mediaAssetId !== null) {
      const asset = await this.prisma.mediaAsset.findUnique({ where: { id: item.mediaAssetId } });
      mimeType = asset?.mimeType ?? "";
    }
    const outcome = await transferObject(source, destinationDriver, item.objectKey, mimeType);
    if (outcome.status === "missing" || outcome.status === "failed") {
      await this.prisma.storageMigrationItem.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          errorMessage:
            outcome.status === "missing"
              ? "File was not on the source storage."
              : "Copy could not be verified on the destination.",
        },
      });
      await this.prisma.storageMigration.update({
        where: { id: item.migrationId },
        data: { failedCount: { increment: 1 } },
      });
      return;
    }
    if (item.mediaAssetId !== null) {
      await this.prisma.mediaAsset.update({
        where: { id: item.mediaAssetId },
        data: { storageProfileId: destination.id, bucket: destination.bucket },
      });
    }
    await this.pointPlaylist(destination, item.objectKey);
    await this.prisma.storageMigrationItem.update({
      where: { id: item.id },
      data: {
        status: outcome.status === "copied" ? "COPIED" : "SKIPPED",
        byteSize: outcome.bytes,
        errorMessage: "",
      },
    });
    await this.prisma.storageMigration.update({
      where: { id: item.migrationId },
      data:
        outcome.status === "copied"
          ? { copiedCount: { increment: 1 } }
          : { skippedCount: { increment: 1 } },
    });
  }

  private async pointPlaylist(destination: StorageConnection, objectKey: string): Promise<void> {
    const match = /^story-hls\/([0-9a-f-]{36})\/index\.m3u8$/i.exec(objectKey);
    const storyId = match?.[1];
    if (storyId === undefined) {
      return;
    }
    const url = publicObjectUrl(
      destination,
      objectKey,
      this.registry.apiOrigin(),
      this.registry.apiPrefix(),
    );
    await this.prisma.story.updateMany({
      where: { id: storyId },
      data: { hlsUrl: url, previewHlsUrl: url },
    });
  }

  private async drain(migrationId: string): Promise<void> {
    const migration = await this.prisma.storageMigration.findUnique({ where: { id: migrationId } });
    if (migration === null || migration.status !== "RUNNING") {
      return;
    }
    const pending = await this.prisma.storageMigrationItem.count({
      where: { migrationId, status: "PENDING" },
    });
    if (pending > 0) {
      return;
    }
    const failed = await this.prisma.storageMigrationItem.count({
      where: { migrationId, status: "FAILED" },
    });
    if (failed > 0) {
      const destination = await this.prisma.storageProfile.findUnique({
        where: { id: migration.toProfileId },
      });
      await this.prisma.storageMigration.update({
        where: { id: migrationId },
        data: {
          status: "FAILED",
          failedCount: failed,
          finishedAt: new Date(),
          errorMessage:
            destination?.isActive === true
              ? "Some files could not be copied. New uploads use the new storage. Failed files still open from the previous one."
              : "Some files could not be copied. The active storage was left unchanged.",
        },
      });
      await this.audit.record({
        actorId: migration.actorId,
        action: "STORAGE_MIGRATION_FAILED",
        entity: "storage_migration",
        entityId: migrationId,
        requestId: `storage-migration:${migrationId}`,
        afterJson: { failed },
      });
      return;
    }
    const added = await this.enqueueStragglers(migration.fromProfileId, migrationId);
    if (added > 0) {
      return;
    }
    await this.registry.activate(migration.toProfileId);
    const after = await this.enqueueStragglers(migration.fromProfileId, migrationId);
    if (after > 0) {
      return;
    }
    await this.deleteSources(migration.fromProfileId, migrationId);
    await this.prisma.storageMigration.update({
      where: { id: migrationId },
      data: { status: "COMPLETED", finishedAt: new Date(), errorMessage: "" },
    });
    await this.audit.record({
      actorId: migration.actorId,
      action: "STORAGE_MIGRATION_COMPLETED",
      entity: "storage_migration",
      entityId: migrationId,
      requestId: `storage-migration:${migrationId}`,
      afterJson: { files: migration.totalCount },
    });
    this.logger.log(`Storage migration ${migrationId} completed`);
  }

  private async enqueueStragglers(fromProfileId: string, migrationId: string): Promise<number> {
    const snapshot = await this.snapshot(fromProfileId);
    const existing = await this.prisma.storageMigrationItem.findMany({
      where: { migrationId },
      select: { objectKey: true },
    });
    const known = new Set(existing.map((item) => item.objectKey));
    const fresh = snapshot.files.filter((file) => !known.has(file.objectKey));
    if (fresh.length === 0) {
      return 0;
    }
    await this.prisma.storageMigrationItem.createMany({
      data: fresh.map((file) => ({
        migrationId,
        mediaAssetId: file.mediaAssetId,
        objectKey: file.objectKey,
        byteSize: file.byteSize,
      })),
      skipDuplicates: true,
    });
    await this.prisma.storageMigration.update({
      where: { id: migrationId },
      data: { totalCount: { increment: fresh.length } },
    });
    return fresh.length;
  }

  private async deleteSources(fromProfileId: string, migrationId: string): Promise<void> {
    const items = await this.prisma.storageMigrationItem.findMany({
      where: { migrationId, status: { in: ["COPIED", "SKIPPED"] } },
    });
    const source = await this.registry.driverForProfile(fromProfileId);
    for (const item of items) {
      await source.remove(item.objectKey);
    }
  }

  private async requireMigration(migrationId: string) {
    const migration = await this.prisma.storageMigration.findUnique({ where: { id: migrationId } });
    if (migration === null) {
      throw new HasutHttpException("NOT_FOUND", "Transfer not found", HttpStatus.NOT_FOUND);
    }
    return migration;
  }
}
