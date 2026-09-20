import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IdentityProviderName } from "@hasut/types";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../../config/env";
import type { OAuthIdentity, OAuthProvider } from "./oauth-provider";

const GRAPH = "https://graph.facebook.com/v21.0";

interface DebugTokenResponse {
  data?: {
    app_id?: string;
    is_valid?: boolean;
    user_id?: string;
    expires_at?: number;
  };
}

interface ProfileResponse {
  id?: string;
  name?: string;
  email?: string;
}

@Injectable()
export class FacebookOAuthProvider implements OAuthProvider {
  readonly provider: IdentityProviderName = "FACEBOOK";
  private readonly logger = new Logger(FacebookOAuthProvider.name);

  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  get configured(): boolean {
    return this.appId().length > 0 && this.appSecret().length > 0;
  }

  async verify(token: string): Promise<OAuthIdentity> {
    if (!this.configured) {
      throw new HasutHttpException(
        "FEATURE_DISABLED",
        "Facebook sign-in is not configured",
        HttpStatus.FORBIDDEN,
      );
    }

    const appToken = `${this.appId()}|${this.appSecret()}`;
    const debug = await this.fetchJson<DebugTokenResponse>(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`,
    );

    // Reject tokens issued to a different Facebook app.
    const data = debug.data;
    if (
      data?.is_valid !== true ||
      data.app_id !== this.appId() ||
      typeof data.user_id !== "string" ||
      data.user_id.length === 0
    ) {
      throw this.rejected();
    }
    if (typeof data.expires_at === "number" && data.expires_at > 0) {
      if (data.expires_at * 1000 <= Date.now()) {
        throw this.rejected();
      }
    }

    const profile = await this.fetchJson<ProfileResponse>(
      `${GRAPH}/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`,
    );
    if (profile.id !== data.user_id) {
      throw this.rejected();
    }

    return {
      provider: this.provider,
      providerAccountId: data.user_id,
      email: profile.email ?? null,
      // Graph only returns an address once Facebook has confirmed it.
      emailVerified: typeof profile.email === "string" && profile.email.length > 0,
      displayName: profile.name ?? null,
    };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      return (await response.json()) as T;
    } catch {
      this.logger.error("Facebook graph request failed");
      throw new HasutHttpException(
        "SERVICE_UNAVAILABLE",
        "Facebook sign-in is temporarily unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private appId(): string {
    return this.config.get("FACEBOOK_APP_ID", { infer: true });
  }

  private appSecret(): string {
    return this.config.get("FACEBOOK_APP_SECRET", { infer: true });
  }

  private rejected(): HasutHttpException {
    return new HasutHttpException(
      "UNAUTHENTICATED",
      "Facebook sign-in could not be verified",
      HttpStatus.UNAUTHORIZED,
    );
  }
}
