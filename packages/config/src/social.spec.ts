import { MESSAGING_POLICY_DEFAULTS, REPORTS_POLICY_DEFAULTS, readReportsPolicy } from "./social";

describe("social policy", () => {
  it("keeps report reasons in configuration", () => {
    expect(REPORTS_POLICY_DEFAULTS.reasonCodes.length).toBeGreaterThan(0);
    expect(readReportsPolicy(null).reasonCodes).toEqual(REPORTS_POLICY_DEFAULTS.reasonCodes);
  });

  it("exposes reconnect delay for websocket clients", () => {
    expect(MESSAGING_POLICY_DEFAULTS.reconnectMs).toBeGreaterThan(0);
  });
});
