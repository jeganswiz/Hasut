export interface PresignPutResult {
  uploadUrl: string;
  headers: Record<string, string>;
}

export interface StoredObjectMeta {
  contentType: string;
  contentLength: number;
}

export interface MediaStorage {
  presignPut(objectKey: string, mimeType: string, ttlSeconds: number): Promise<PresignPutResult>;
  head(objectKey: string): Promise<StoredObjectMeta | null>;
  publicUrl(objectKey: string): string;
}

export const MEDIA_STORAGE = Symbol("MEDIA_STORAGE");
