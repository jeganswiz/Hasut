import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Logger } from "@nestjs/common";
import type {
  MediaStorage,
  PresignPutResult,
  StoredObjectInfo,
  StoredObjectMeta,
} from "./media-storage";
import { StorageProbeError } from "./local-media.storage";
import type { StorageConnection } from "./storage-url";
import { publicObjectUrl } from "./storage-url";

export class S3MediaStorage implements MediaStorage {
  private readonly logger = new Logger(S3MediaStorage.name);
  private readonly client: S3Client;

  constructor(
    private readonly connection: StorageConnection,
    private readonly apiOrigin: string,
    private readonly apiPrefix: string,
  ) {
    this.client = new S3Client({
      region: connection.region.length > 0 ? connection.region : "us-east-1",
      endpoint: connection.endpoint.length > 0 ? connection.endpoint : undefined,
      forcePathStyle: connection.forcePathStyle,
      credentials: {
        accessKeyId: connection.accessKey,
        secretAccessKey: connection.secretKey,
      },
    });
  }

  async presignPut(
    objectKey: string,
    mimeType: string,
    ttlSeconds: number,
  ): Promise<PresignPutResult> {
    const command = new PutObjectCommand({
      Bucket: this.connection.bucket,
      Key: objectKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
    return {
      uploadUrl,
      headers: { "Content-Type": mimeType },
    };
  }

  async head(objectKey: string): Promise<StoredObjectMeta | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.connection.bucket, Key: objectKey }),
      );
      return {
        contentType: result.ContentType ?? "application/octet-stream",
        contentLength: result.ContentLength ?? 0,
      };
    } catch (error) {
      if (!isMissingObject(error)) {
        this.logger.warn(
          `Media object is not readable: ${error instanceof Error ? error.name : "error"}`,
        );
      }
      return null;
    }
  }

  async read(objectKey: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.connection.bucket, Key: objectKey }),
      );
      const body = result.Body;
      if (body === undefined || !("transformToByteArray" in body)) {
        return null;
      }
      return Buffer.from(await body.transformToByteArray());
    } catch (error) {
      if (!isMissingObject(error)) {
        this.logger.warn(
          `Media object is not readable: ${error instanceof Error ? error.name : "error"}`,
        );
      }
      return null;
    }
  }

  async write(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.connection.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async remove(objectKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.connection.bucket, Key: objectKey }),
      );
    } catch (error) {
      this.logger.warn(`Media delete failed: ${error instanceof Error ? error.name : "error"}`);
    }
  }

  async list(): Promise<StoredObjectInfo[]> {
    const found: StoredObjectInfo[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.connection.bucket,
          ContinuationToken: token,
        }),
      );
      for (const item of page.Contents ?? []) {
        if (item.Key === undefined || item.Key.endsWith("/") || item.Key.startsWith(".")) {
          continue;
        }
        found.push({ key: item.Key, size: item.Size ?? 0 });
      }
      token = page.IsTruncated === true ? page.NextContinuationToken : undefined;
    } while (token !== undefined);
    return found;
  }

  async probe(): Promise<void> {
    const key = `.hasut-probe-${this.connection.id}`;
    try {
      await this.write(key, Buffer.from("ok"), "text/plain");
      const head = await this.head(key);
      await this.remove(key);
      if (head === null) {
        throw new StorageProbeError();
      }
    } catch (error) {
      if (error instanceof StorageProbeError) {
        throw error;
      }
      this.logger.warn(`Storage probe failed: ${error instanceof Error ? error.name : "error"}`);
      throw new StorageProbeError();
    }
  }

  publicUrl(objectKey: string): string {
    return publicObjectUrl(this.connection, objectKey, this.apiOrigin, this.apiPrefix);
  }
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  if (name === "NotFound" || name === "NoSuchKey") {
    return true;
  }
  const meta = "$metadata" in error ? error.$metadata : undefined;
  return (
    typeof meta === "object" &&
    meta !== null &&
    "httpStatusCode" in meta &&
    meta.httpStatusCode === 404
  );
}
