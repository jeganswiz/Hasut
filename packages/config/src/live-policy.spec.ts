import {
  LIVE_POLICY_DEFAULTS,
  containsBlockedWord,
  isLivePolicy,
  normalizeBlockedWords,
  readLivePolicy,
} from "./live-policy";

describe("readLivePolicy", () => {
  it("returns defaults for a missing policy", () => {
    expect(readLivePolicy(undefined)).toEqual(LIVE_POLICY_DEFAULTS);
    expect(isLivePolicy(LIVE_POLICY_DEFAULTS)).toBe(true);
  });

  it("keeps operator values and fills missing caps", () => {
    const policy = readLivePolicy({
      idleTimeoutSeconds: 45,
      categories: [" Workshop ", ""],
      blockedWords: ["Spam", "spam", " scam "],
    });
    expect(policy.idleTimeoutSeconds).toBe(45);
    expect(policy.heartbeatSeconds).toBe(LIVE_POLICY_DEFAULTS.heartbeatSeconds);
    expect(policy.categories).toEqual(["Workshop"]);
    expect(policy.blockedWords).toEqual(["spam", "scam"]);
  });

  it("ignores caps that are not positive numbers", () => {
    expect(readLivePolicy({ chatMaxChars: -1 }).chatMaxChars).toBe(
      LIVE_POLICY_DEFAULTS.chatMaxChars,
    );
  });
});

describe("blocked words", () => {
  it("matches whole words regardless of case", () => {
    const words = normalizeBlockedWords(["Scam"]);
    expect(containsBlockedWord("This is a SCAM!", words)).toBe(true);
    expect(containsBlockedWord("scampi for dinner", words)).toBe(false);
    expect(containsBlockedWord("all good", [])).toBe(false);
  });
});
