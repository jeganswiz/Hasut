import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { maskEmail } from "@hasut/utils";
import { createTransport, type Transporter } from "nodemailer";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../../config/env";
import type { EmailProvider, SendEmailOtpInput, SendEmailResult } from "./email-provider";

function subjectFor(purpose: SendEmailOtpInput["purpose"]): string {
  if (purpose === "PASSWORD_RESET") {
    return "Reset your HASUT password";
  }
  if (purpose === "TWO_FACTOR") {
    return "Your HASUT verification code";
  }
  return "Your HASUT sign-in code";
}

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  async sendOtp(input: SendEmailOtpInput): Promise<SendEmailResult> {
    const minutes = Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60_000));
    const text = [
      `Your HASUT code is ${input.code}.`,
      `It expires in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      "If you did not request this, ignore this email and nobody gains access.",
    ].join("\n\n");

    try {
      const info = await this.transport().sendMail({
        from: this.config.get("EMAIL_FROM", { infer: true }),
        to: input.email,
        subject: subjectFor(input.purpose),
        text,
      });
      return { providerMessageId: info.messageId };
    } catch {
      // Log the masked recipient only; never the code or the transport URL.
      this.logger.error(`SMTP delivery failed for ${maskEmail(input.email)}`);
      throw new HasutHttpException(
        "SERVICE_UNAVAILABLE",
        "Email delivery is temporarily unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private transport(): Transporter {
    this.transporter ??= createTransport(this.config.get("SMTP_URL", { infer: true }));
    return this.transporter;
  }
}
