import { createHash } from "node:crypto";
import type { MediaStorage } from "./media-storage";

export type TransferOutcome =
  | { status: "copied"; bytes: number }
  | { status: "skipped"; bytes: number }
  | { status: "missing" }
  | { status: "failed" };

export async function transferObject(
  source: MediaStorage,
  destination: MediaStorage,
  objectKey: string,
  preferredType: string,
): Promise<TransferOutcome> {
  const sourceHead = await source.head(objectKey);
  const destinationHead = await destination.head(objectKey);
  if (sourceHead === null && destinationHead !== null && destinationHead.contentLength > 0) {
    return { status: "skipped", bytes: destinationHead.contentLength };
  }
  if (sourceHead === null) {
    return { status: "missing" };
  }
  const body = await source.read(objectKey);
  if (body === null) {
    return { status: "missing" };
  }
  if (
    destinationHead !== null &&
    destinationHead.contentLength === body.length &&
    body.length > 0
  ) {
    const existing = await destination.read(objectKey);
    if (
      existing !== null &&
      createHash("sha256").update(existing).digest("hex") ===
        createHash("sha256").update(body).digest("hex")
    ) {
      return { status: "skipped", bytes: body.length };
    }
  }
  const contentType =
    sourceHead.contentType === "application/octet-stream" && preferredType.length > 0
      ? preferredType
      : sourceHead.contentType;
  try {
    await destination.write(objectKey, body, contentType);
  } catch {
    return { status: "failed" };
  }
  const check = await destination.head(objectKey);
  if (check === null || check.contentLength !== body.length) {
    return { status: "failed" };
  }
  return { status: "copied", bytes: body.length };
}

export function decideStorageSwitch(input: {
  movableCount: number;
  migrate: boolean | undefined;
}): "confirm" | "migrate" | "switch" {
  if (input.movableCount > 0 && input.migrate === undefined) {
    return "confirm";
  }
  if (input.migrate === true && input.movableCount > 0) {
    return "migrate";
  }
  return "switch";
}
