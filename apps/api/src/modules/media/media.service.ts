import { randomUUID } from "node:crypto";
import type { MediaAssetView, MediaPresignResult, MediaPurpose } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import type { StoredObjectMeta } from "./storage/media-storage";
import { StorageRegistry } from "./storage/storage-registry.service";

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly audit: AuditService,
    private readonly storage: StorageRegistry,
  ) {}

  async presign(
    ownerMemberId: string,
    input: { purpose: MediaPurpose; mimeType: string; byteSize: number },
    requestId: string,
    uploadOrigin: string | null = null,
  ): Promise<MediaPresignResult> {
    const policy = await this.configuration.getMediaPolicy();
    if (!policy.allowedMimeTypes.includes(input.mimeType)) {
      throw new HasutHttpException(
        "MEDIA_REJECTED",
        "This file type is not allowed",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.purpose === "AVATAR" && input.byteSize > policy.avatarMaxBytes) {
      throw new HasutHttpException("MEDIA_REJECTED", "File is too large", HttpStatus.BAD_REQUEST);
    }

    const mediaId = randomUUID();
    const objectKey = `${input.purpose.toLowerCase()}/${ownerMemberId}/${mediaId}`;
    const presign = await this.storage.presign(
      objectKey,
      input.mimeType,
      policy.presignTtlSeconds,
      uploadOrigin,
    );
    const created = await this.prisma.mediaAsset.create({
      data: {
        id: mediaId,
        ownerMemberId,
        bucket: presign.profile.bucket,
        objectKey,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        purpose: input.purpose,
        status: "PENDING_UPLOAD",
        storageProfileId: presign.profile.id,
      },
    });
    await this.audit.record({
      actorId: ownerMemberId,
      action: "MEDIA_PRESIGNED",
      entity: "media_asset",
      entityId: created.id,
      requestId,
      afterJson: { purpose: input.purpose },
    });

    return {
      mediaId: created.id,
      uploadUrl: presign.uploadUrl,
      objectKey,
      headers: presign.headers,
      expiresAt: new Date(Date.now() + policy.presignTtlSeconds * 1000).toISOString(),
    };
  }

  async complete(
    ownerMemberId: string,
    mediaId: string,
    requestId: string,
  ): Promise<MediaAssetView> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (asset === null || asset.ownerMemberId !== ownerMemberId) {
      throw new HasutHttpException("NOT_FOUND", "Media not found", HttpStatus.NOT_FOUND);
    }

    const policy = await this.configuration.getMediaPolicy();
    const head = await this.storage.head(asset.objectKey);
    if (head === null) {
      throw new HasutHttpException(
        "MEDIA_REJECTED",
        "Upload was not found",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      !policy.allowedMimeTypes.includes(head.contentType) &&
      head.contentType !== asset.mimeType
    ) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED" },
      });
      throw new HasutHttpException(
        "MEDIA_REJECTED",
        "Uploaded file type is not allowed",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (asset.purpose === "AVATAR" && head.contentLength > policy.avatarMaxBytes) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED" },
      });
      throw new HasutHttpException(
        "MEDIA_REJECTED",
        "Uploaded file is too large",
        HttpStatus.BAD_REQUEST,
      );
    }

    const ready = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: "READY",
        byteSize: head.contentLength > 0 ? head.contentLength : asset.byteSize,
      },
    });

    await this.audit.record({
      actorId: ownerMemberId,
      action: "MEDIA_COMPLETED",
      entity: "media_asset",
      entityId: ready.id,
      requestId,
      afterJson: { purpose: ready.purpose },
    });

    return this.toView(ready);
  }

  async requireReadyVerification(ownerMemberId: string, mediaIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(mediaIds)];
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: uniqueIds } },
    });
    if (assets.length !== uniqueIds.length) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "Verification media not found",
        HttpStatus.NOT_FOUND,
      );
    }
    for (const asset of assets) {
      if (asset.ownerMemberId !== ownerMemberId) {
        throw new HasutHttpException(
          "NOT_FOUND",
          "Verification media not found",
          HttpStatus.NOT_FOUND,
        );
      }
      if (asset.purpose !== "VERIFICATION" || asset.status !== "READY") {
        throw new HasutHttpException(
          "MEDIA_REJECTED",
          "Verification document is not ready",
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async requireReadyChatImage(ownerMemberId: string, mediaId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (asset === null || asset.ownerMemberId !== ownerMemberId) {
      throw new HasutHttpException("NOT_FOUND", "Media not found", HttpStatus.NOT_FOUND);
    }
    if (asset.purpose !== "CHAT" || asset.status !== "READY") {
      throw new HasutHttpException(
        "MEDIA_REJECTED",
        "Chat image is not ready",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async requireReadyAvatar(ownerMemberId: string, mediaId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (asset === null || asset.ownerMemberId !== ownerMemberId) {
      throw new HasutHttpException("NOT_FOUND", "Media not found", HttpStatus.NOT_FOUND);
    }
    if (asset.purpose !== "AVATAR" || asset.status !== "READY") {
      throw new HasutHttpException(
        "MEDIA_REJECTED",
        "Profile photo is not ready",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  readObject(objectKey: string): Promise<Buffer | null> {
    return this.storage.read(objectKey);
  }

  writeObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    return this.storage.write(objectKey, body, contentType);
  }

  objectUrl(objectKey: string): string {
    return this.storage.activePublicUrl(objectKey);
  }

  headObject(objectKey: string): Promise<StoredObjectMeta | null> {
    return this.storage.head(objectKey);
  }

  async photoUrl(mediaId: string | null): Promise<string | null> {
    if (mediaId === null) {
      return null;
    }
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (asset === null || asset.status !== "READY" || asset.purpose === "VERIFICATION") {
      return null;
    }
    return this.storage.urlForProfile(asset.storageProfileId, asset.objectKey);
  }

  async toView(asset: {
    id: string;
    purpose: MediaPurpose;
    status: "PENDING_UPLOAD" | "READY" | "REJECTED";
    mimeType: string;
    byteSize: number;
    objectKey: string;
    storageProfileId?: string | null;
  }): Promise<MediaAssetView> {
    const url =
      asset.status === "READY" && asset.purpose !== "VERIFICATION"
        ? await this.storage.urlForProfile(asset.storageProfileId ?? null, asset.objectKey)
        : null;
    return {
      id: asset.id,
      purpose: asset.purpose,
      status: asset.status,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      url,
    };
  }
}
