export const PWA_DISMISS_KEY = "hasut.pwa-dismiss";

export type PwaInstallKind = "hidden" | "prompt" | "ios-hint";

export function readStandaloneDisplay(input: {
  matchMedia?: (query: string) => { matches: boolean };
  navigatorStandalone?: boolean;
}): boolean {
  if (input.navigatorStandalone === true) {
    return true;
  }
  return input.matchMedia?.("(display-mode: standalone)").matches === true;
}

export function isIosSafari(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function pwaInstallKind(input: {
  standalone: boolean;
  dismissed: boolean;
  canPrompt: boolean;
  userAgent: string;
}): PwaInstallKind {
  if (input.standalone || input.dismissed) {
    return "hidden";
  }
  if (input.canPrompt) {
    return "prompt";
  }
  if (isIosSafari(input.userAgent)) {
    return "ios-hint";
  }
  return "hidden";
}

export function readPwaDismissed(storage: Pick<Storage, "getItem"> | null): boolean {
  if (storage === null) {
    return false;
  }
  try {
    return storage.getItem(PWA_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writePwaDismissed(storage: Pick<Storage, "setItem"> | null): void {
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(PWA_DISMISS_KEY, "1");
  } catch {
    // Private mode can refuse sessionStorage.
  }
}
