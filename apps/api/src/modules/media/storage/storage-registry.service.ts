import { randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { STORAGE_PROVIDER_CATALOG, type StorageBackendName } from "@hasut/types";
import { MEDIA_UPLOAD_MAX_BYTES } from "@hasut/validation";
import { HttpStatus, Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { StorageBackend } from "@prisma/client";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CredentialDecryptError,
  decryptSecret,
  encryptSecret,
  storageCipherKey,
} from "./credential-cipher";
import { LocalMediaStorage, StorageProbeError } from "./local-media.storage";
import type { MediaStorage, StoredObjectInfo, StoredObjectMeta } from "./media-storage";
import { S3MediaStorage } from "./s3-media.storage";
import { assertObjectKey } from "./storage-key";
import {
  fromPrismaProvider,
  providerOption,
  publicObjectUrl,
  resolveStorageEndpoint,
  toPrismaProvider,
  type StorageConnection,
} from "./storage-url";
import { readUploadToken, signUploadToken } from "./upload-token";

interface ProfileRow {
  id: string;
  provider: StorageBackend;
  label: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyEnc: string;
  secretKeyEnc: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  localRoot: string;
  isActive: boolean;
  updatedAt: Date;
  createdAt: Date;
}

interface CachedDriver {
  updatedAt: string;
  uploadOrigin: string;
  driver: MediaStorage;
}

export interface OpenedObject {
  body: Buffer;
  contentType: string;
}

@Injectable()
export class StorageRegistry implements OnModuleInit {
  private cached: StorageConnection | null = null;
  private readonly drivers = new Map<string, CachedDriver>();
  private opening: Promise<StorageConnection> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureActive();
  }

  async ensureActive(): Promise<StorageConnection> {
    if (this.cached !== null) {
      return this.cached;
    }
    if (this.opening === null) {
      this.opening = this.loadOrCreate().finally(() => {
        this.opening = null;
      });
    }
    return this.opening;
  }

  activePublicUrl(objectKey: string): string {
    const connection = this.cached ?? this.fallbackConnection();
    return publicObjectUrl(connection, objectKey, this.apiOrigin(), this.apiPrefix());
  }

  async urlForProfile(profileId: string | null, objectKey: string): Promise<string> {
    const connection =
      profileId === null ? await this.ensureActive() : await this.connectionById(profileId);
    return publicObjectUrl(connection, objectKey, this.apiOrigin(), this.apiPrefix());
  }

  async presign(
    objectKey: string,
    mimeType: string,
    ttlSeconds: number,
    uploadOrigin: string | null,
  ): Promise<{ profile: StorageConnection; uploadUrl: string; headers: Record<string, string> }> {
    const profile = await this.ensureActive();
    const driver = this.driverFor(profile, uploadOrigin ?? this.apiOrigin());
    const presign = await driver.presignPut(objectKey, mimeType, ttlSeconds);
    return { profile, uploadUrl: presign.uploadUrl, headers: presign.headers };
  }

  async head(objectKey: string): Promise<StoredObjectMeta | null> {
    const driver = await this.driverForKey(objectKey);
    return driver.head(objectKey);
  }

  async read(objectKey: string): Promise<Buffer | null> {
    const driver = await this.driverForKey(objectKey);
    return driver.read(objectKey);
  }

  async write(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    const profile = await this.ensureActive();
    await this.driverFor(profile, this.apiOrigin()).write(objectKey, body, contentType);
  }

  async open(objectKey: string): Promise<OpenedObject | null> {
    try {
      assertObjectKey(objectKey);
    } catch {
      return null;
    }
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { objectKey },
      orderBy: { createdAt: "desc" },
    });
    if (asset !== null) {
      if (asset.purpose === "VERIFICATION" || asset.status !== "READY") {
        return null;
      }
      const driver =
        asset.storageProfileId === null
          ? this.driverFor(await this.ensureActive(), this.apiOrigin())
          : await this.driverForProfile(asset.storageProfileId);
      const body = await driver.read(objectKey);
      if (body === null) {
        return null;
      }
      return { body, contentType: contentTypeFor(objectKey, asset.mimeType) };
    }
    if (!objectKey.startsWith("story-hls/")) {
      return null;
    }
    const profiles = await this.prisma.storageProfile.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    for (const profile of profiles) {
      const driver = this.driverFor(this.toConnection(profile), this.apiOrigin());
      const body = await driver.read(objectKey);
      if (body !== null) {
        const head = await driver.head(objectKey);
        return {
          body,
          contentType: contentTypeFor(objectKey, head?.contentType ?? "application/octet-stream"),
        };
      }
    }
    return null;
  }

  async saveUpload(token: string, body: Buffer): Promise<void> {
    const claims = readUploadToken(this.tokenSecret(), token, Date.now());
    if (claims === null) {
      throw new HasutHttpException("FORBIDDEN", "Upload link expired", HttpStatus.FORBIDDEN);
    }
    if (body.length === 0 || body.length > MEDIA_UPLOAD_MAX_BYTES) {
      throw new HasutHttpException("MEDIA_REJECTED", "File is too large", HttpStatus.BAD_REQUEST);
    }
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { objectKey: claims.objectKey },
      orderBy: { createdAt: "desc" },
    });
    if (
      asset === null ||
      asset.storageProfileId !== claims.profileId ||
      asset.status !== "PENDING_UPLOAD"
    ) {
      throw new HasutHttpException("NOT_FOUND", "Media not found", HttpStatus.NOT_FOUND);
    }
    const driver = await this.driverForProfile(claims.profileId);
    await driver.write(claims.objectKey, body, asset.mimeType);
  }

  async driverForProfile(profileId: string): Promise<MediaStorage> {
    const connection = await this.connectionById(profileId);
    return this.driverFor(connection, this.apiOrigin());
  }

  async connectionById(profileId: string): Promise<StorageConnection> {
    const row = await this.prisma.storageProfile.findUnique({ where: { id: profileId } });
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Storage profile not found", HttpStatus.NOT_FOUND);
    }
    return this.toConnection(row);
  }

  async listProfile(profileId: string): Promise<StoredObjectInfo[]> {
    const driver = await this.driverForProfile(profileId);
    try {
      return await driver.list();
    } catch (error) {
      if (error instanceof StorageProbeError) {
        throw new HasutHttpException("VALIDATION_ERROR", error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Could not list files on the current storage.",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  probe(connection: StorageConnection): Promise<void> {
    return this.driverFor(connection, this.apiOrigin()).probe();
  }

  remember(connection: StorageConnection): void {
    this.cached = connection;
    this.drivers.delete(connection.id);
  }

  draftConnection(input: {
    provider: StorageBackendName;
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle?: boolean;
    publicBaseUrl: string;
    localRoot: string;
  }): StorageConnection {
    const option = providerOption(input.provider);
    const region = input.region.length > 0 ? input.region : option.defaultRegion;
    const endpoint = resolveStorageEndpoint(input.provider, region, input.endpoint);
    const forcePathStyle = input.forcePathStyle ?? option.defaultForcePathStyle;
    if (input.publicBaseUrl.length > 0) {
      let parsed: URL;
      try {
        parsed = new URL(input.publicBaseUrl);
      } catch {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Public URL must be an http or https address",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Public URL must be an http or https address",
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (input.provider === "local") {
      if (input.localRoot.includes("..")) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Storage path cannot contain ..",
          HttpStatus.BAD_REQUEST,
        );
      }
      const root = input.localRoot.length > 0 ? resolve(input.localRoot) : this.defaultLocalRoot();
      if (!isAbsolute(root)) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Storage path must be absolute",
          HttpStatus.BAD_REQUEST,
        );
      }
      return {
        id: randomUUID(),
        provider: "local",
        label: option.label,
        endpoint: "",
        region: "",
        bucket: input.bucket.length > 0 ? input.bucket : "local",
        accessKey: "",
        secretKey: "",
        forcePathStyle: false,
        publicBaseUrl: input.publicBaseUrl.replace(/\/$/, ""),
        localRoot: root,
        updatedAt: new Date().toISOString(),
      };
    }
    if (input.bucket.length === 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "A bucket name is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.accessKey.length === 0 || input.secretKey.length === 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Access key and secret are required",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.provider !== "s3" && endpoint.length === 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "An endpoint is required for this storage",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (endpoint.length > 0) {
      try {
        const parsed = new URL(endpoint);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("protocol");
        }
      } catch {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Endpoint must be an http or https URL",
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    return {
      id: randomUUID(),
      provider: input.provider,
      label: option.label,
      endpoint,
      region,
      bucket: input.bucket,
      accessKey: input.accessKey,
      secretKey: input.secretKey,
      forcePathStyle,
      publicBaseUrl: input.publicBaseUrl.replace(/\/$/, ""),
      localRoot: "",
      updatedAt: new Date().toISOString(),
    };
  }

  async insertProfile(connection: StorageConnection, active: boolean): Promise<StorageConnection> {
    const key = this.cipherKey();
    const row = await this.prisma.storageProfile.create({
      data: {
        id: connection.id,
        provider: toPrismaProvider(connection.provider),
        label: connection.label,
        endpoint: connection.endpoint,
        region: connection.region,
        bucket: connection.bucket,
        accessKeyEnc: encryptSecret(connection.accessKey, key),
        secretKeyEnc: encryptSecret(connection.secretKey, key),
        forcePathStyle: connection.forcePathStyle,
        publicBaseUrl: connection.publicBaseUrl,
        localRoot: connection.localRoot,
        isActive: active,
      },
    });
    return this.toConnection(row);
  }

  async activate(profileId: string): Promise<StorageConnection> {
    await this.prisma.$transaction([
      this.prisma.storageProfile.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      this.prisma.storageProfile.update({
        where: { id: profileId },
        data: { isActive: true },
      }),
    ]);
    const connection = await this.connectionById(profileId);
    this.remember(connection);
    return connection;
  }

  apiOrigin(): string {
    const configured = this.config.get("API_PUBLIC_URL", { infer: true }).trim().replace(/\/$/, "");
    if (configured.length > 0) {
      return configured;
    }
    return `http://127.0.0.1:${this.config.get("PORT", { infer: true })}`;
  }

  apiPrefix(): string {
    return this.config.get("API_PREFIX", { infer: true }).replace(/^\/|\/$/g, "");
  }

  private async loadOrCreate(): Promise<StorageConnection> {
    const actives = await this.prisma.storageProfile.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    const first = actives[0];
    if (first !== undefined) {
      if (actives.length > 1) {
        await this.prisma.storageProfile.updateMany({
          where: { isActive: true, id: { not: first.id } },
          data: { isActive: false },
        });
      }
      const connection = this.toConnection(first);
      this.cached = connection;
      await this.backfill(connection);
      return connection;
    }
    const draft = this.bootstrapConnection();
    const created = await this.insertProfile(draft, true);
    this.cached = created;
    await this.backfill(created);
    return created;
  }

  private async backfill(connection: StorageConnection): Promise<void> {
    await this.prisma.mediaAsset.updateMany({
      where: { storageProfileId: null },
      data: { storageProfileId: connection.id, bucket: connection.bucket },
    });
  }

  private bootstrapConnection(): StorageConnection {
    const mode = this.config.get("MEDIA_STORAGE", { infer: true });
    if (mode === "s3") {
      const endpoint = this.config.get("S3_ENDPOINT", { infer: true }).trim().replace(/\/$/, "");
      const provider: StorageBackendName = endpoint.length > 0 ? "minio" : "s3";
      const option = STORAGE_PROVIDER_CATALOG.find((item) => item.id === provider);
      return {
        id: randomUUID(),
        provider,
        label: option?.label ?? "Object storage",
        endpoint,
        region: this.config.get("S3_REGION", { infer: true }),
        bucket: this.config.get("S3_BUCKET", { infer: true }),
        accessKey: this.config.get("S3_ACCESS_KEY", { infer: true }),
        secretKey: this.config.get("S3_SECRET_KEY", { infer: true }),
        forcePathStyle: isTrueFlag(this.config.get("S3_FORCE_PATH_STYLE", { infer: true })),
        publicBaseUrl: "",
        localRoot: "",
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      id: randomUUID(),
      provider: "local",
      label: "Server storage",
      endpoint: "",
      region: "",
      bucket: "local",
      accessKey: "",
      secretKey: "",
      forcePathStyle: false,
      publicBaseUrl: "",
      localRoot: this.defaultLocalRoot(),
      updatedAt: new Date().toISOString(),
    };
  }

  private fallbackConnection(): StorageConnection {
    return {
      id: "fallback",
      provider: "local",
      label: "Server storage",
      endpoint: "",
      region: "",
      bucket: "local",
      accessKey: "",
      secretKey: "",
      forcePathStyle: false,
      publicBaseUrl: "",
      localRoot: this.defaultLocalRoot(),
      updatedAt: new Date(0).toISOString(),
    };
  }

  private defaultLocalRoot(): string {
    const configured = this.config.get("MEDIA_LOCAL_ROOT", { infer: true }).trim();
    if (configured.length > 0) {
      return resolve(configured);
    }
    return resolve(process.cwd(), "var", "media");
  }

  private async driverForKey(objectKey: string): Promise<MediaStorage> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { objectKey },
      orderBy: { createdAt: "desc" },
      select: { storageProfileId: true },
    });
    if (asset?.storageProfileId) {
      return this.driverForProfile(asset.storageProfileId);
    }
    const active = await this.ensureActive();
    return this.driverFor(active, this.apiOrigin());
  }

  private driverFor(connection: StorageConnection, uploadOrigin: string): MediaStorage {
    const hit = this.drivers.get(connection.id);
    if (
      hit !== undefined &&
      hit.updatedAt === connection.updatedAt &&
      hit.uploadOrigin === uploadOrigin
    ) {
      return hit.driver;
    }
    const driver =
      connection.provider === "local"
        ? new LocalMediaStorage(
            connection.localRoot,
            this.readBase(connection),
            uploadOrigin,
            this.apiPrefix(),
            (objectKey, ttlSeconds) =>
              signUploadToken(this.tokenSecret(), {
                objectKey,
                profileId: connection.id,
                expiresAtMs: Date.now() + ttlSeconds * 1000,
              }),
          )
        : new S3MediaStorage(connection, this.apiOrigin(), this.apiPrefix());
    this.drivers.set(connection.id, {
      updatedAt: connection.updatedAt,
      uploadOrigin,
      driver,
    });
    return driver;
  }

  private readBase(connection: StorageConnection): string {
    return connection.publicBaseUrl.length > 0 ? connection.publicBaseUrl : this.apiOrigin();
  }

  private toConnection(row: ProfileRow): StorageConnection {
    let accessKey = "";
    let secretKey = "";
    try {
      accessKey = decryptSecret(row.accessKeyEnc, this.cipherKey());
      secretKey = decryptSecret(row.secretKeyEnc, this.cipherKey());
    } catch (error) {
      if (error instanceof CredentialDecryptError) {
        throw new HasutHttpException(
          "INTERNAL_ERROR",
          "Stored storage credentials could not be read",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw error;
    }
    return {
      id: row.id,
      provider: fromPrismaProvider(row.provider),
      label: row.label,
      endpoint: row.endpoint,
      region: row.region,
      bucket: row.bucket,
      accessKey,
      secretKey,
      forcePathStyle: row.forcePathStyle,
      publicBaseUrl: row.publicBaseUrl,
      localRoot: row.localRoot,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private cipherKey(): Buffer {
    return storageCipherKey(
      this.config.get("STORAGE_CREDENTIALS_KEY", { infer: true }),
      this.config.get("JWT_ACCESS_SECRET", { infer: true }),
    );
  }

  private tokenSecret(): string {
    return this.config.get("JWT_ACCESS_SECRET", { infer: true });
  }
}

function contentTypeFor(objectKey: string, fallback: string): string {
  if (objectKey.endsWith(".m3u8")) {
    return "application/vnd.apple.mpegurl";
  }
  if (objectKey.endsWith(".ts")) {
    return "video/mp2t";
  }
  return fallback.length > 0 ? fallback : "application/octet-stream";
}

function isTrueFlag(value: string | boolean): boolean {
  return value === true || value === "true";
}
