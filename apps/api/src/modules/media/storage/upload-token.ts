import { createHmac, timingSafeEqual } from "node:crypto";
import { assertObjectKey } from "./storage-key";

interface UploadTokenPayload {
  k: string;
  p: string;
  e: number;
}

export function signUploadToken(
  secret: string,
  input: { objectKey: string; profileId: string; expiresAtMs: number },
): string {
  const body = Buffer.from(
    JSON.stringify({
      k: input.objectKey,
      p: input.profileId,
      e: input.expiresAtMs,
    } satisfies UploadTokenPayload),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readUploadToken(
  secret: string,
  token: string,
  nowMs: number,
): { objectKey: string; profileId: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  let payload: UploadTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UploadTokenPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.k !== "string" ||
    typeof payload.p !== "string" ||
    typeof payload.e !== "number" ||
    payload.e <= nowMs
  ) {
    return null;
  }
  try {
    assertObjectKey(payload.k);
  } catch {
    return null;
  }
  return { objectKey: payload.k, profileId: payload.p };
}
