import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpCodeGenerator } from "./otp-code.generator";
import { otpProviderFactory } from "./providers/otp-provider.factory";
import { RateLimitService } from "./rate-limit.service";
import { Argon2SecretHasher, SECRET_HASHER } from "./secret-hasher";
import { TokenService } from "./token.service";

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    RateLimitService,
    OtpCodeGenerator,
    Argon2SecretHasher,
    { provide: SECRET_HASHER, useExisting: Argon2SecretHasher },
    otpProviderFactory,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
