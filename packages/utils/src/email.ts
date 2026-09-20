const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isEmail(value: string): boolean {
  const compact = value.trim();
  return compact.length <= 254 && EMAIL.test(compact);
}

/** Lowercase form used as the unique lookup key. Never shown back to the member. */
export function normalizeEmail(value: string): string {
  const compact = value.trim().toLowerCase();
  if (!isEmail(compact)) {
    throw new Error("Invalid email address");
  }
  return compact;
}

export function coerceEmail(value: string): string | null {
  const compact = value.trim().toLowerCase();
  return isEmail(compact) ? compact : null;
}

/** `jegan@gmail.com` → `je•••@gmail.com`. Safe for UI copy and logs. */
export function maskEmail(value: string): string {
  const at = value.lastIndexOf("@");
  if (at <= 0) {
    return "•••";
  }
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}•••${domain}`;
}

/** `+917010358490` → `•••••• 8490`. Never return more than the last four digits. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "••••";
  }
  return `•••••• ${digits.slice(-4)}`;
}
