import type { MemberRole } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sign, verify, type Secret, type SignOptions } from "jsonwebtoken";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../config/env";

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  roles: MemberRole[];
}

@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  signAccess(claims: AccessTokenClaims, ttlSeconds: number): string {
    const secret: Secret = this.config.get("JWT_ACCESS_SECRET", { infer: true });
    const options: SignOptions = {
      expiresIn: ttlSeconds,
      issuer: "hasut",
    };
    return sign(claims, secret, options);
  }

  verifyAccess(token: string): AccessTokenClaims {
    try {
      const secret: Secret = this.config.get("JWT_ACCESS_SECRET", { infer: true });
      const decoded = verify(token, secret, { issuer: "hasut" });
      if (!isAccessTokenClaims(decoded)) {
        throw new HasutHttpException(
          "UNAUTHENTICATED",
          "Invalid access token",
          HttpStatus.UNAUTHORIZED,
        );
      }
      return decoded;
    } catch (error) {
      if (error instanceof HasutHttpException) {
        throw error;
      }
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "Invalid access token",
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}

function isAccessTokenClaims(value: unknown): value is AccessTokenClaims {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.sub === "string" &&
    typeof record.sid === "string" &&
    Array.isArray(record.roles) &&
    record.roles.every((role) => typeof role === "string")
  );
}
