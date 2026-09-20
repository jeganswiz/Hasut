import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CredentialsService } from "./credentials.service";
import { OtpCodeGenerator } from "./otp-code.generator";
import { captchaVerifierFactory } from "./providers/captcha-verifier.factory";
import { emailProviderFactory } from "./providers/email-provider.factory";
import { oauthRegistryFactory } from "./providers/oauth-registry.factory";
import { otpProviderFactory } from "./providers/otp-provider.factory";
import { RateLimitService } from "./rate-limit.service";
import { Argon2SecretHasher, SECRET_HASHER } from "./secret-hasher";
import { TokenService } from "./token.service";

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    CredentialsService,
    TokenService,
    RateLimitService,
    OtpCodeGenerator,
    Argon2SecretHasher,
    { provide: SECRET_HASHER, useExisting: Argon2SecretHasher },
    otpProviderFactory,
    emailProviderFactory,
    captchaVerifierFactory,
    oauthRegistryFactory,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, CredentialsService, TokenService],
})
export class AuthModule {}
