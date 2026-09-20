import type { IdentityProviderName } from "@hasut/types";

export const OAUTH_REGISTRY = Symbol("OAUTH_REGISTRY");

export interface OAuthIdentity {
  provider: IdentityProviderName;
  /** Stable subject id at the provider. The join key, not the email. */
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export interface OAuthProvider {
  readonly provider: IdentityProviderName;
  readonly configured: boolean;
  verify(token: string): Promise<OAuthIdentity>;
}

export interface OAuthRegistry {
  enabled(): Record<Lowercase<IdentityProviderName>, boolean>;
  get(provider: IdentityProviderName): OAuthProvider;
}
