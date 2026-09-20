import { HttpStatus, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IdentityProviderName } from "@hasut/types";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../../config/env";
import { FacebookOAuthProvider } from "./facebook-oauth.provider";
import { GoogleOAuthProvider } from "./google-oauth.provider";
import { OAUTH_REGISTRY, type OAuthProvider, type OAuthRegistry } from "./oauth-provider";

export const oauthRegistryFactory: Provider = {
  provide: OAUTH_REGISTRY,
  inject: [ConfigService],
  useFactory: (config: ConfigService<ApiEnv, true>): OAuthRegistry => {
    const providers: Record<IdentityProviderName, OAuthProvider> = {
      GOOGLE: new GoogleOAuthProvider(config),
      FACEBOOK: new FacebookOAuthProvider(config),
    };
    return {
      enabled: () => ({
        google: providers.GOOGLE.configured,
        facebook: providers.FACEBOOK.configured,
      }),
      get: (provider) => {
        const selected = providers[provider];
        if (!selected.configured) {
          throw new HasutHttpException(
            "FEATURE_DISABLED",
            "This sign-in provider is not configured",
            HttpStatus.FORBIDDEN,
          );
        }
        return selected;
      },
    };
  },
};
