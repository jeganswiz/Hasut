const E164 = /^\+[1-9]\d{7,14}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const INDIAN_WITH_COUNTRY = /^91[6-9]\d{9}$/;

/** Accepts E.164, `91XXXXXXXXXX`, or a 10-digit Indian mobile. */
export function coercePhoneE164(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  if (E164.test(compact)) {
    return compact;
  }
  if (INDIAN_WITH_COUNTRY.test(compact)) {
    return `+${compact}`;
  }
  if (INDIAN_MOBILE.test(compact)) {
    return `+91${compact}`;
  }
  return null;
}

export function normalizePhoneE164(value: string): string {
  const phone = coercePhoneE164(value);
  if (phone === null) {
    throw new Error("Invalid E.164 phone number");
  }
  return phone;
}

export function isE164Phone(value: string): boolean {
  return coercePhoneE164(value) !== null;
}
