import type {
  AuthClientConfig,
  AuthLoginResult,
  AuthSessionView,
  AuthTokens,
  AuthVerifyResult,
  CurrentMember,
  LogoutAllResult,
  LogoutResult,
  OtpChallengeReceipt,
  PasswordResetTicket,
  PasswordUpdateResult,
} from "@hasut/types";
import {
  logoutSchema,
  otpRequestSchema,
  otpResendSchema,
  otpVerifySchema,
  passwordChangeSchema,
  passwordForgotSchema,
  passwordLoginSchema,
  passwordRegisterSchema,
  passwordResetSchema,
  passwordResetVerifySchema,
  ssoLoginSchema,
  tokenRefreshSchema,
  twoFactorSettingSchema,
  twoFactorVerifySchema,
} from "@hasut/validation";
import { Body, Controller, Get, Post, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { clientIp, clientUserAgent, type RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CredentialsService } from "./credentials.service";

type OtpRequestBody = z.infer<typeof otpRequestSchema>;
type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
type OtpResendBody = z.infer<typeof otpResendSchema>;
type TokenRefreshBody = z.infer<typeof tokenRefreshSchema>;
type LogoutBody = z.infer<typeof logoutSchema>;
type RegisterBody = z.infer<typeof passwordRegisterSchema>;
type PasswordLoginBody = z.infer<typeof passwordLoginSchema>;
type TwoFactorVerifyBody = z.infer<typeof twoFactorVerifySchema>;
type TwoFactorSettingBody = z.infer<typeof twoFactorSettingSchema>;
type SsoLoginBody = z.infer<typeof ssoLoginSchema>;
type ForgotBody = z.infer<typeof passwordForgotSchema>;
type ResetVerifyBody = z.infer<typeof passwordResetVerifySchema>;
type ResetBody = z.infer<typeof passwordResetSchema>;
type PasswordChangeBody = z.infer<typeof passwordChangeSchema>;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly credentials: CredentialsService,
  ) {}

  @Public()
  @Get("config")
  @ApiOperation({ summary: "Captcha, SSO, and password policy for sign-in screens" })
  config(): Promise<AuthClientConfig> {
    return this.credentials.clientConfig();
  }

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
  @Post("password/register")
  @ApiOperation({ summary: "Create an account with email and password" })
  register(
    @Body(new ZodValidationPipe(passwordRegisterSchema)) body: RegisterBody,
    @Req() req: Request,
  ): Promise<AuthVerifyResult> {
    return this.credentials.register(body, this.context(req));
  }

  @Public()
  @Post("password/login")
  @ApiOperation({ summary: "Sign in with email and password, or start the second step" })
  loginWithPassword(
    @Body(new ZodValidationPipe(passwordLoginSchema)) body: PasswordLoginBody,
    @Req() req: Request,
  ): Promise<AuthLoginResult> {
    return this.credentials.loginWithPassword(body, this.context(req));
  }

  @Public()
  @Post("two-factor/verify")
  @ApiOperation({ summary: "Complete a two-step sign in" })
  verifyTwoFactor(
    @Body(new ZodValidationPipe(twoFactorVerifySchema)) body: TwoFactorVerifyBody,
    @Req() req: Request,
  ): Promise<AuthVerifyResult> {
    return this.credentials.verifyTwoFactor(body, this.context(req));
  }

  @Public()
  @Post("sso")
  @ApiOperation({ summary: "Sign in with a verified Google or Facebook account" })
  loginWithSso(
    @Body(new ZodValidationPipe(ssoLoginSchema)) body: SsoLoginBody,
    @Req() req: Request,
  ): Promise<AuthVerifyResult> {
    return this.credentials.loginWithSso(body, this.context(req));
  }

  @Public()
  @Post("password/forgot")
  @ApiOperation({ summary: "Send a password reset code to a phone or email" })
  forgotPassword(
    @Body(new ZodValidationPipe(passwordForgotSchema)) body: ForgotBody,
    @Req() req: Request,
  ): Promise<OtpChallengeReceipt> {
    return this.credentials.forgotPassword(body, this.context(req));
  }

  @Public()
  @Post("password/reset/verify")
  @ApiOperation({ summary: "Exchange a verified reset code for a single-use ticket" })
  verifyPasswordReset(
    @Body(new ZodValidationPipe(passwordResetVerifySchema)) body: ResetVerifyBody,
    @Req() req: Request,
  ): Promise<PasswordResetTicket> {
    return this.credentials.verifyPasswordReset(body, this.context(req));
  }

  @Public()
  @Post("password/reset")
  @ApiOperation({ summary: "Set a new password with a reset ticket" })
  resetPassword(
    @Body(new ZodValidationPipe(passwordResetSchema)) body: ResetBody,
    @Req() req: Request,
  ): Promise<PasswordUpdateResult> {
    return this.credentials.resetPassword(body, this.context(req));
  }

  @ApiBearerAuth()
  @Post("password")
  @ApiOperation({ summary: "Change the password for the current member" })
  changePassword(
    @CurrentUser() actor: RequestAuthContext,
    @Body(new ZodValidationPipe(passwordChangeSchema)) body: PasswordChangeBody,
    @Req() req: Request,
  ): Promise<PasswordUpdateResult> {
    return this.credentials.changePassword(actor.memberId, body, this.context(req));
  }

  @ApiBearerAuth()
  @Put("two-factor")
  @ApiOperation({ summary: "Turn two-step verification on or off" })
  setTwoFactor(
    @CurrentUser() actor: RequestAuthContext,
    @Body(new ZodValidationPipe(twoFactorSettingSchema)) body: TwoFactorSettingBody,
    @Req() req: Request,
  ): Promise<CurrentMember> {
    return this.credentials.setTwoFactor(actor.memberId, body.enabled, this.context(req));
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
