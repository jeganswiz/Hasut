import type { OtpPurpose } from "@hasut/types";

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

export interface SendEmailOtpInput {
  email: string;
  code: string;
  purpose: OtpPurpose;
  expiresAt: Date;
}

export interface SendEmailResult {
  providerMessageId?: string;
}

/**
 * HASUT owns the challenge lifecycle exactly as it does for SMS. An email
 * vendor only delivers the message.
 */
export interface EmailProvider {
  sendOtp(input: SendEmailOtpInput): Promise<SendEmailResult>;
}
