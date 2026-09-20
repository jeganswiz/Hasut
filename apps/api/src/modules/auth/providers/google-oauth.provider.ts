import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IdentityProviderName } from "@hasut/types";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../../config/env";
import type { OAuthIdentity, OAuthProvider } from "./oauth-provider";

const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

interface GoogleTokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  exp?: string;
}

@Injectable()
export class GoogleOAuthProvider implements OAuthProvider {
  readonly provider: IdentityProviderName = "GOOGLE";
  private readonly logger = new Logger(GoogleOAuthProvider.name);

  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  get configured(): boolean {
    return this.clientId().length > 0;
  }

  async verify(token: string): Promise<OAuthIdentity> {
    const clientId = this.clientId();
    if (clientId.length === 0) {
      throw new HasutHttpException(
        "FEATURE_DISABLED",
        "Google sign-in is not configured",
        HttpStatus.FORBIDDEN,
      );
    }

    let info: GoogleTokenInfo;
    try {
      const url = `${TOKENINFO_URL}?id_token=${encodeURIComponent(token)}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      info = (await response.json()) as GoogleTokenInfo;
    } catch {
      this.logger.error("Google token verification request failed");
      throw new HasutHttpException(
        "SERVICE_UNAVAILABLE",
        "Google sign-in is temporarily unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // A token minted for another app must never sign someone in here.
    if (info.aud !== clientId || typeof info.sub !== "string" || info.sub.length === 0) {
      throw this.rejected();
    }
    if (info.exp !== undefined && Number(info.exp) * 1000 <= Date.now()) {
      throw this.rejected();
    }

    return {
      provider: this.provider,
      providerAccountId: info.sub,
      email: info.email ?? null,
      emailVerified: info.email_verified === true || info.email_verified === "true",
      displayName: info.name ?? null,
    };
  }

  private clientId(): string {
    return this.config.get("GOOGLE_CLIENT_ID", { infer: true });
  }

  private rejected(): HasutHttpException {
    return new HasutHttpException(
      "UNAUTHENTICATED",
      "Google sign-in could not be verified",
      HttpStatus.UNAUTHORIZED,
    );
  }
}
