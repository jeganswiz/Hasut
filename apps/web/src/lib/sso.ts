import type { IdentityProviderName } from "@hasut/types";
import { loadScript } from "./script-loader";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup";
    auto_select?: boolean;
  }) => void;
  prompt: (listener?: (notification: { isNotDisplayed: () => boolean }) => void) => void;
  cancel: () => void;
}

interface FacebookLoginResponse {
  status?: string;
  authResponse?: { accessToken?: string } | null;
}

interface FacebookSdk {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: FacebookLoginResponse) => void, options: { scope: string }) => void;
}

interface SsoGlobals {
  google?: { accounts?: { id?: GoogleAccountsId } };
  FB?: FacebookSdk;
}

function ssoGlobals(): SsoGlobals {
  return globalThis as SsoGlobals;
}

function googleAccountsId(): GoogleAccountsId | undefined {
  return ssoGlobals().google?.accounts?.id;
}

function facebookSdk(): FacebookSdk | undefined {
  return ssoGlobals().FB;
}

export class SsoCancelled extends Error {
  constructor() {
    super("Sign-in was cancelled");
    this.name = "SsoCancelled";
  }
}

/** Resolves with a Google ID token that the API verifies against its client id. */
export async function googleIdToken(clientId: string): Promise<string> {
  await loadScript("https://accounts.google.com/gsi/client");
  const accounts = googleAccountsId();
  if (accounts === undefined) {
    throw new Error("Google sign-in is unavailable");
  }
  return new Promise<string>((resolve, reject) => {
    accounts.initialize({
      client_id: clientId,
      ux_mode: "popup",
      auto_select: false,
      callback: (response) => {
        if (typeof response.credential === "string" && response.credential.length > 0) {
          resolve(response.credential);
          return;
        }
        reject(new SsoCancelled());
      },
    });
    accounts.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        reject(new SsoCancelled());
      }
    });
  });
}

/** Resolves with a Facebook access token that the API validates via debug_token. */
export async function facebookAccessToken(appId: string): Promise<string> {
  await loadScript("https://connect.facebook.net/en_US/sdk.js");
  const sdk = facebookSdk();
  if (sdk === undefined) {
    throw new Error("Facebook sign-in is unavailable");
  }
  sdk.init({ appId, cookie: false, xfbml: false, version: "v21.0" });
  return new Promise<string>((resolve, reject) => {
    sdk.login(
      (response) => {
        const token = response.authResponse?.accessToken;
        if (response.status === "connected" && typeof token === "string" && token.length > 0) {
          resolve(token);
          return;
        }
        reject(new SsoCancelled());
      },
      { scope: "public_profile,email" },
    );
  });
}

export async function ssoToken(
  provider: IdentityProviderName,
  keys: { googleClientId: string; facebookAppId: string },
): Promise<string> {
  return provider === "GOOGLE"
    ? googleIdToken(keys.googleClientId)
    : facebookAccessToken(keys.facebookAppId);
}
