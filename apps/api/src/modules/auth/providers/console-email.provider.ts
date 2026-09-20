import { Injectable, Logger } from "@nestjs/common";
import { maskEmail } from "@hasut/utils";
import type { EmailProvider, SendEmailOtpInput, SendEmailResult } from "./email-provider";

/**
 * Local development only; the env schema forbids it in production. The code is
 * returned through the challenge receipt's `debugCode`, never written to a log.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async sendOtp(input: SendEmailOtpInput): Promise<SendEmailResult> {
    this.logger.log(`OTP email dispatched via console adapter to ${maskEmail(input.email)}`);
    return {};
  }
}
