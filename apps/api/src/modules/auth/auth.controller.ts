import type {
  AuthSessionView,
  AuthTokens,
  AuthVerifyResult,
  LogoutAllResult,
  LogoutResult,
  OtpChallengeReceipt,
} from "@hasut/types";
import {
  logoutSchema,
  otpRequestSchema,
  otpResendSchema,
  otpVerifySchema,
  tokenRefreshSchema,
} from "@hasut/validation";
import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { clientIp, clientUserAgent, type RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

type OtpRequestBody = z.infer<typeof otpRequestSchema>;
type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
type OtpResendBody = z.infer<typeof otpResendSchema>;
type TokenRefreshBody = z.infer<typeof tokenRefreshSchema>;
type LogoutBody = z.infer<typeof logoutSchema>;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("otp/request")
  @ApiOperation({ summary: "Request a phone OTP" })
  requestOtp(
    @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequestBody,
    @Req() req: Request,
  ): Promise<OtpChallengeReceipt> {
    return this.auth.requestOtp(body, this.context(req));
  }

  @Public()
  @Post("otp/verify")
  @ApiOperation({ summary: "Verify a phone OTP and issue a session" })
  verifyOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerifyBody,
    @Req() req: Request,
  ): Promise<AuthVerifyResult> {
    return this.auth.verifyOtp(body, this.context(req));
  }

  @Public()
  @Post("otp/resend")
  @ApiOperation({ summary: "Resend the active phone OTP" })
  resendOtp(
    @Body(new ZodValidationPipe(otpResendSchema)) body: OtpResendBody,
    @Req() req: Request,
  ): Promise<OtpChallengeReceipt> {
    return this.auth.resendOtp(body, this.context(req));
  }

  @Public()
  @Post("token/refresh")
  @ApiOperation({ summary: "Rotate the refresh token and issue a new access token" })
  refresh(
    @Body(new ZodValidationPipe(tokenRefreshSchema)) body: TokenRefreshBody,
    @Req() req: Request,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body, this.context(req));
  }

  @ApiBearerAuth()
  @Post("logout")
  @ApiOperation({ summary: "Revoke the current or specified session" })
  logout(
    @CurrentUser() actor: RequestAuthContext,
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutBody,
    @Req() req: Request,
  ): Promise<LogoutResult> {
    return this.auth.logout(actor, body, this.context(req));
  }

  @ApiBearerAuth()
  @Post("logout-all")
  @ApiOperation({ summary: "Revoke every session for the current member" })
  logoutAll(
    @CurrentUser() actor: RequestAuthContext,
    @Req() req: Request,
  ): Promise<LogoutAllResult> {
    return this.auth.logoutAll(actor, this.context(req));
  }

  @ApiBearerAuth()
  @Get("sessions")
  @ApiOperation({ summary: "List active sessions for the current member" })
  sessions(@CurrentUser() actor: RequestAuthContext): Promise<AuthSessionView[]> {
    return this.auth.listSessions(actor);
  }

  private context(req: Request) {
    return {
      ip: clientIp(req),
      userAgent: clientUserAgent(req),
      requestId: getRequestId(req),
    };
  }
}
