import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
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
export class TwilioOtpProvider implements OtpProvider {
  readonly style: OtpAdapterStyle = "delegated";

  async sendOtp(_input: SendOtpInput): Promise<SendOtpResult> {
    this.unavailable();
  }

  async verifyOtp(_input: VerifyOtpInput): Promise<VerifyOtpResult> {
    this.unavailable();
  }

  async resendOtp(_input: ResendOtpInput): Promise<SendOtpResult> {
    this.unavailable();
  }

  private unavailable(): never {
    throw new HasutHttpException(
      "FEATURE_DISABLED",
      "Twilio OTP adapter is not implemented",
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
