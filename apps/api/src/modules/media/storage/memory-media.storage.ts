import { Injectable } from "@nestjs/common";
import type { MediaStorage, PresignPutResult, StoredObjectMeta } from "./media-storage";

@Injectable()
export class MemoryMediaStorage implements MediaStorage {
  private readonly objects = new Map<string, StoredObjectMeta>();
  private readonly bodies = new Map<string, Buffer>();

  async presignPut(
    objectKey: string,
    mimeType: string,
    ttlSeconds: number,
  ): Promise<PresignPutResult> {
    this.objects.set(objectKey, { contentType: mimeType, contentLength: 0 });
    return {
      uploadUrl: `memory://upload/${objectKey}?ttl=${ttlSeconds}`,
      headers: { "Content-Type": mimeType },
    };
  }

  async head(objectKey: string): Promise<StoredObjectMeta | null> {
    return this.objects.get(objectKey) ?? null;
  }

  async read(objectKey: string): Promise<Buffer | null> {
    const body = this.bodies.get(objectKey);
    return body === undefined ? null : Buffer.from(body);
  }

  async write(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    const copy = Buffer.from(body);
    this.bodies.set(objectKey, copy);
    this.objects.set(objectKey, { contentType, contentLength: copy.length });
  }

  publicUrl(objectKey: string): string {
    return `memory://${objectKey}`;
  }

  complete(objectKey: string, mimeType: string, byteSize: number): void {
    this.objects.set(objectKey, { contentType: mimeType, contentLength: byteSize });
  }
}
