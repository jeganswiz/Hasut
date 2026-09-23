import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../../config/env";
import type { MediaStorage, PresignPutResult, StoredObjectMeta } from "./media-storage";

@Injectable()
export class S3MediaStorage implements MediaStorage {
  private readonly logger = new Logger(S3MediaStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(config: ConfigService<ApiEnv, true>) {
    this.bucket = config.get("S3_BUCKET", { infer: true });
    this.endpoint = config.get("S3_ENDPOINT", { infer: true });
    this.client = new S3Client({
      region: config.get("S3_REGION", { infer: true }),
      endpoint: this.endpoint.length > 0 ? this.endpoint : undefined,
      forcePathStyle: isTrueFlag(config.get("S3_FORCE_PATH_STYLE", { infer: true })),
      credentials: {
        accessKeyId: config.get("S3_ACCESS_KEY", { infer: true }),
        secretAccessKey: config.get("S3_SECRET_KEY", { infer: true }),
      },
    });
  }

  async presignPut(
    objectKey: string,
    mimeType: string,
    ttlSeconds: number,
  ): Promise<PresignPutResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
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
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        contentType: result.ContentType ?? "application/octet-stream",
        contentLength: result.ContentLength ?? 0,
      };
    } catch (error) {
      this.logger.warn(
        `Media object is not readable: ${error instanceof Error ? error.name : "error"}`,
      );
      return null;
    }
  }

  async read(objectKey: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      const body = result.Body;
      if (body === undefined || !("transformToByteArray" in body)) {
        return null;
      }
      return Buffer.from(await body.transformToByteArray());
    } catch (error) {
      this.logger.warn(
        `Media object is not readable: ${error instanceof Error ? error.name : "error"}`,
      );
      return null;
    }
  }

  async write(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  publicUrl(objectKey: string): string {
    if (this.endpoint.length === 0) {
      return objectKey;
    }
    return `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${objectKey}`;
  }
}

function isTrueFlag(value: string | boolean): boolean {
  return value === true || value === "true";
}
