export interface TimeIdCursor {
  createdAt: string;
  id: string;
}

export function encodeTimeIdCursor(value: TimeIdCursor): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeTimeIdCursor(cursor: string): TimeIdCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.createdAt !== "string" || typeof record.id !== "string") {
      return null;
    }
    return { createdAt: record.createdAt, id: record.id };
  } catch {
    return null;
  }
}
