const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return fallbackUuidV4();
}

export function normalizeRequestId(value: string | undefined): string {
  if (value === undefined) {
    return createRequestId();
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return createRequestId();
  }
  return trimmed;
}

export function isUuidV4(value: string): boolean {
  return UUID_V4.test(value);
}

function fallbackUuidV4(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const version = bytes[6];
  const variant = bytes[8];
  if (version === undefined || variant === undefined) {
    throw new Error("Failed to generate request id");
  }
  bytes[6] = (version & 0x0f) | 0x40;
  bytes[8] = (variant & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
