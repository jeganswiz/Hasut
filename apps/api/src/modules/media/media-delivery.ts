import type { Request, Response } from "express";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { StorageRegistry } from "./storage/storage-registry.service";
import { assertObjectKey } from "./storage/storage-key";
import { MEDIA_UPLOAD_MAX_BYTES } from "@hasut/validation";

@Injectable()
export class MediaDelivery {
  constructor(private readonly registry: StorageRegistry) {}

  async receiveUpload(req: Request, res: Response): Promise<void> {
    const token = typeof req.params.token === "string" ? req.params.token : "";
    try {
      const body = await readBody(req, MEDIA_UPLOAD_MAX_BYTES);
      await this.registry.saveUpload(token, body);
      if (!res.headersSent) {
        res.status(200).end();
      }
    } catch (error) {
      if (!res.headersSent) {
        const status = error instanceof HasutHttpException ? error.getStatus() : 500;
        res.status(status).end();
      }
    }
  }

  async receiveFile(req: Request, res: Response): Promise<void> {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).end();
      return;
    }
    const objectKey = objectKeyFromUrl(req.originalUrl);
    if (objectKey === null) {
      res.status(404).end();
      return;
    }
    try {
      const opened = await this.registry.open(objectKey);
      if (opened === null) {
        res.status(404).end();
        return;
      }
      writeBytes(req, res, opened.body, opened.contentType);
    } catch {
      if (!res.headersSent) {
        res.status(404).end();
      }
    }
  }
}

export function registerMediaHttpRoutes(
  http: {
    put: (path: string, handler: (req: Request, res: Response) => void) => void;
    use: (path: string, handler: (req: Request, res: Response) => void) => void;
  },
  delivery: MediaDelivery,
  apiPrefix: string,
): void {
  const prefix = apiPrefix.replace(/^\/|\/$/g, "");
  http.put(`/${prefix}/media/local-upload/:token`, (req, res) => {
    void delivery.receiveUpload(req, res);
  });
  http.use(`/${prefix}/media/files`, (req, res) => {
    void delivery.receiveFile(req, res);
  });
}

function objectKeyFromUrl(originalUrl: string): string | null {
  const pathOnly = originalUrl.split("?")[0] ?? "";
  const marker = "/media/files/";
  const index = pathOnly.indexOf(marker);
  if (index < 0) {
    return null;
  }
  const raw = pathOnly.slice(index + marker.length);
  if (raw.length === 0) {
    return null;
  }
  try {
    const objectKey = raw
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    assertObjectKey(objectKey);
    return objectKey;
  } catch {
    return null;
  }
}

function readBody(req: Request, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(
          new HasutHttpException("MEDIA_REJECTED", "File is too large", HttpStatus.BAD_REQUEST),
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => reject(new Error("read_failed")));
  });
}

function writeBytes(req: Request, res: Response, body: Buffer, contentType: string): void {
  const total = body.length;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "HEAD") {
    res.setHeader("Content-Length", String(total));
    res.status(200).end();
    return;
  }
  const header = req.headers.range;
  if (typeof header === "string" && header.length > 0) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(header);
    if (match === null) {
      res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
      return;
    }
    const start = Number(match[1]);
    const end = match[2] !== undefined && match[2].length > 0 ? Number(match[2]) : total - 1;
    if (start >= total || end < start || end >= total) {
      res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
      return;
    }
    const slice = body.subarray(start, end + 1);
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    res.setHeader("Content-Length", String(slice.length));
    res.end(slice);
    return;
  }
  res.setHeader("Content-Length", String(total));
  res.status(200).end(body);
}
