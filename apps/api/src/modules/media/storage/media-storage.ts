export interface PresignPutResult {
  uploadUrl: string;
  headers: Record<string, string>;
}

export interface StoredObjectMeta {
  contentType: string;
  contentLength: number;
}

export interface StoredObjectInfo {
  key: string;
  size: number;
}

export interface MediaStorage {
  presignPut(objectKey: string, mimeType: string, ttlSeconds: number): Promise<PresignPutResult>;
  head(objectKey: string): Promise<StoredObjectMeta | null>;
  /** Bytes for a stored object. Null when the upload has not landed. */
  read(objectKey: string): Promise<Buffer | null>;
  write(objectKey: string, body: Buffer, contentType: string): Promise<void>;
  remove(objectKey: string): Promise<void>;
  list(): Promise<StoredObjectInfo[]>;
  /** Throws when the backend cannot accept a file. */
  probe(): Promise<void>;
  publicUrl(objectKey: string): string;
}
