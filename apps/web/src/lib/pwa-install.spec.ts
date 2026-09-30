import {
  PWA_DISMISS_KEY,
  pwaInstallKind,
  readPwaDismissed,
  readStandaloneDisplay,
  writePwaDismissed,
} from "./pwa-install";

describe("pwaInstallKind", () => {
  it("hides the banner when the app is already installed or dismissed", () => {
    expect(
      pwaInstallKind({
        standalone: true,
        dismissed: false,
        canPrompt: true,
        userAgent: "Mozilla/5.0",
      }),
    ).toBe("hidden");
    expect(
      pwaInstallKind({
        standalone: false,
        dismissed: true,
        canPrompt: true,
        userAgent: "Mozilla/5.0",
      }),
    ).toBe("hidden");
  });

  it("offers a Chromium install prompt when the browser deferred one", () => {
    expect(
      pwaInstallKind({
        standalone: false,
        dismissed: false,
        canPrompt: true,
        userAgent: "Mozilla/5.0 Chrome",
      }),
    ).toBe("prompt");
  });

  it("hints at the iOS Home Screen path when there is no install event", () => {
    expect(
      pwaInstallKind({
        standalone: false,
        dismissed: false,
        canPrompt: false,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      }),
    ).toBe("ios-hint");
  });
});

describe("standalone and dismiss storage", () => {
  it("treats display-mode standalone or iOS navigator.standalone as installed", () => {
    expect(readStandaloneDisplay({ navigatorStandalone: true })).toBe(true);
    expect(
      readStandaloneDisplay({
        matchMedia: (query) => ({ matches: query.includes("standalone") }),
      }),
    ).toBe(true);
    expect(readStandaloneDisplay({})).toBe(false);
  });

  it("stores a session dismiss without throwing when storage is missing", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(readPwaDismissed(storage)).toBe(false);
    writePwaDismissed(storage);
    expect(readPwaDismissed(storage)).toBe(true);
    expect(store.get(PWA_DISMISS_KEY)).toBe("1");
    writePwaDismissed(null);
    expect(readPwaDismissed(null)).toBe(false);
  });
});
