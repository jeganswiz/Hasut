import type { OtpChannel } from "@hasut/types";
import { maskEmail, maskPhone } from "@hasut/utils";
import { HttpStatus } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";

/**
 * A one-time code always targets exactly one destination. Resolving it once
 * keeps channel branching out of every use case.
 */
export interface OtpDestination {
  channel: OtpChannel;
  phoneE164: string | null;
  email: string | null;
}

export function resolveDestination(input: { phone?: string; email?: string }): OtpDestination {
  if (typeof input.phone === "string" && typeof input.email === "string") {
    throw new HasutHttpException(
      "VALIDATION_ERROR",
      "Provide exactly one of phone or email",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (typeof input.phone === "string") {
    return { channel: "SMS", phoneE164: input.phone, email: null };
  }
  if (typeof input.email === "string") {
    return { channel: "EMAIL", phoneE164: null, email: input.email };
  }
  throw new HasutHttpException(
    "VALIDATION_ERROR",
    "Provide a phone number or an email address",
    HttpStatus.BAD_REQUEST,
  );
}

/** Rate-limit bucket key. Distinct per channel so SMS abuse cannot block email. */
export function destinationKey(destination: OtpDestination): string {
  return destination.channel === "SMS"
    ? `phone:${destination.phoneE164 ?? ""}`
    : `email:${destination.email ?? ""}`;
}

/** UI copy only. Never returns a full phone number or email address. */
export function destinationHint(destination: OtpDestination): string {
  if (destination.channel === "SMS") {
    return maskPhone(destination.phoneE164 ?? "");
  }
  return maskEmail(destination.email ?? "");
}
