import { Injectable } from "@nestjs/common";
import type { MediaStorage, PresignPutResult, StoredObjectMeta } from "./media-storage";

@Injectable()
export class MemoryMediaStorage implements MediaStorage {
  private readonly objects = new Map<string, StoredObjectMeta>();

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

  publicUrl(objectKey: string): string {
    return `memory://${objectKey}`;
  }

  complete(objectKey: string, mimeType: string, byteSize: number): void {
    this.objects.set(objectKey, { contentType: mimeType, contentLength: byteSize });
  }
}
