import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export class CredentialDecryptError extends Error {
  constructor() {
    super("Stored storage credentials could not be read");
    this.name = "CredentialDecryptError";
  }
}

export function storageCipherKey(dedicated: string, accessSecret: string): Buffer {
  const material = dedicated.trim().length > 0 ? dedicated.trim() : accessSecret;
  return createHash("sha256").update(`hasut-storage-v1:${material}`).digest();
}

export function encryptSecret(plain: string, key: Buffer): string {
  if (plain.length === 0) {
    return "";
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${data.toString("base64url")}`;
}

export function decryptSecret(payload: string, key: Buffer): string {
  if (payload.length === 0) {
    return "";
  }
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new CredentialDecryptError();
  }
  try {
    const iv = Buffer.from(parts[0] ?? "", "base64url");
    const tag = Buffer.from(parts[1] ?? "", "base64url");
    const data = Buffer.from(parts[2] ?? "", "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new CredentialDecryptError();
  }
}
