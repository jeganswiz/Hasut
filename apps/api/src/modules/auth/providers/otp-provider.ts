import type { OtpPurpose } from "@hasut/types";

export type OtpAdapterStyle = "transport" | "delegated";

export interface SendOtpInput {
  phoneE164: string;
  code: string;
  purpose: OtpPurpose;
  expiresAt: Date;
}

export interface SendOtpResult {
  providerMessageId?: string;
}

export interface VerifyOtpInput {
  phoneE164: string;
  code: string;
  purpose: OtpPurpose;
}

export interface VerifyOtpResult {
  valid: boolean;
}

export type ResendOtpInput = SendOtpInput;

export interface OtpProvider {
  readonly style: OtpAdapterStyle;
  sendOtp(input: SendOtpInput): Promise<SendOtpResult>;
  verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult>;
  resendOtp(input: ResendOtpInput): Promise<SendOtpResult>;
}

export const OTP_PROVIDER = Symbol("OTP_PROVIDER");
