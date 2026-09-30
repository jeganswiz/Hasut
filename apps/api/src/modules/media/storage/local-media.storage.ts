import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  MediaStorage,
  PresignPutResult,
  StoredObjectInfo,
  StoredObjectMeta,
} from "./media-storage";
import { assertObjectKey } from "./storage-key";
import { encodeObjectKey } from "./storage-url";

export class StorageProbeError extends Error {
  constructor() {
    super("Could not reach that storage. Check the endpoint, bucket, region, and keys.");
    this.name = "StorageProbeError";
  }
}

function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel.length === 0 || (!rel.startsWith("..") && !isAbsolute(rel));
}

export class LocalMediaStorage implements MediaStorage {
  constructor(
    private readonly root: string,
    private readonly readBase: string,
    private readonly uploadBase: string,
    private readonly apiPrefix: string,
    private readonly sign: (objectKey: string, ttlSeconds: number) => string,
  ) {}

  async presignPut(
    objectKey: string,
    mimeType: string,
    ttlSeconds: number,
  ): Promise<PresignPutResult> {
    assertObjectKey(objectKey);
    const token = this.sign(objectKey, ttlSeconds);
    return {
      uploadUrl: `${this.uploadBase.replace(/\/$/, "")}/${this.apiPrefix}/media/local-upload/${token}`,
      headers: { "Content-Type": mimeType },
    };
  }

  async head(objectKey: string): Promise<StoredObjectMeta | null> {
    const full = this.resolveKey(objectKey);
    try {
      const info = await stat(full);
      if (!info.isFile()) {
        return null;
      }
      return {
        contentType: await this.readType(full),
        contentLength: info.size,
      };
    } catch {
      return null;
    }
  }

  async read(objectKey: string): Promise<Buffer | null> {
    const full = this.resolveKey(objectKey);
    try {
      return await readFile(full);
    } catch {
      return null;
    }
  }

  async write(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    const full = this.resolveKey(objectKey);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
    await writeFile(`${full}.mime`, contentType, "utf8");
  }

  async remove(objectKey: string): Promise<void> {
    const full = this.resolveKey(objectKey);
    await rm(full, { force: true });
    await rm(`${full}.mime`, { force: true });
  }

  async list(): Promise<StoredObjectInfo[]> {
    const found: StoredObjectInfo[] = [];
    await this.walk(this.root, found);
    return found;
  }

  async probe(): Promise<void> {
    try {
      await mkdir(this.root, { recursive: true });
      const probeKey = ".hasut-probe";
      const full = join(this.root, probeKey);
      await writeFile(full, "ok");
      await rm(full, { force: true });
    } catch {
      throw new StorageProbeError();
    }
  }

  publicUrl(objectKey: string): string {
    const encoded = encodeObjectKey(objectKey);
    return `${this.readBase.replace(/\/$/, "")}/${this.apiPrefix}/media/files/${encoded}`;
  }

  private resolveKey(objectKey: string): string {
    assertObjectKey(objectKey);
    const full = resolve(this.root, ...objectKey.split("/"));
    if (!isInsideRoot(this.root, full)) {
      throw new Error("Invalid object key");
    }
    return full;
  }

  private async readType(full: string): Promise<string> {
    try {
      const mime = (await readFile(`${full}.mime`, "utf8")).trim();
      return mime.length > 0 ? mime : "application/octet-stream";
    } catch {
      return "application/octet-stream";
    }
  }

  private async walk(directory: string, found: StoredObjectInfo[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".hasut-probe" || entry.name.endsWith(".mime")) {
        continue;
      }
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.walk(full, found);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const key = relative(this.root, full).split(sep).join("/");
      try {
        assertObjectKey(key);
      } catch {
        continue;
      }
      const info = await stat(full);
      found.push({ key, size: info.size });
    }
  }
}
