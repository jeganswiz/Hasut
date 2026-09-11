import { Injectable, Logger } from "@nestjs/common";
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
export class ConsoleOtpProvider implements OtpProvider {
  readonly style: OtpAdapterStyle = "transport";
  private readonly logger = new Logger(ConsoleOtpProvider.name);

  async sendOtp(_input: SendOtpInput): Promise<SendOtpResult> {
    this.logger.log("OTP dispatched via console adapter");
    return {};
  }

  async verifyOtp(_input: VerifyOtpInput): Promise<VerifyOtpResult> {
    return { valid: true };
  }

  async resendOtp(input: ResendOtpInput): Promise<SendOtpResult> {
    return this.sendOtp(input);
  }
}
