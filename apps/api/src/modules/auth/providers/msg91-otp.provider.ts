import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../../config/env";
import type {
  OtpAdapterStyle,
  OtpProvider,
  ResendOtpInput,
  SendOtpInput,
  SendOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "./otp-provider";

@Injectable()
export class Msg91OtpProvider implements OtpProvider {
  readonly style: OtpAdapterStyle = "transport";
  private readonly logger = new Logger(Msg91OtpProvider.name);

  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  async sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
    const authKey = this.config.get("MSG91_AUTH_KEY", { infer: true });
    const templateId = this.config.get("MSG91_TEMPLATE_ID", { infer: true });
    const sender = this.config.get("MSG91_SENDER", { infer: true });
    if (authKey.length === 0 || templateId.length === 0) {
      throw new HasutHttpException(
        "SERVICE_UNAVAILABLE",
        "MSG91 is not configured",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const expiryMinutes = Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60_000));
    const mobile = input.phoneE164.startsWith("+") ? input.phoneE164.slice(1) : input.phoneE164;

    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        sender,
        mobile,
        otp: input.code,
        otp_expiry: expiryMinutes,
      }),
    });

    if (!response.ok) {
      this.logger.error(`MSG91 send failed with status ${response.status}`);
      throw new HasutHttpException(
        "SERVICE_UNAVAILABLE",
        "OTP delivery is temporarily unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {};
  }

  async verifyOtp(_input: VerifyOtpInput): Promise<VerifyOtpResult> {
    return { valid: true };
  }

  async resendOtp(input: ResendOtpInput): Promise<SendOtpResult> {
    return this.sendOtp(input);
  }
}
