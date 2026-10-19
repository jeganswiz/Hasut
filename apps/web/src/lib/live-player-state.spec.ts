import { nextPlayerPhase } from "./live-player-state";

describe("nextPlayerPhase", () => {
  it("moves waiting to playing once the playlist is ready", () => {
    expect(nextPlayerPhase("waiting", "ready")).toBe("playing");
  });

  it("reconnects after a fatal error during playback", () => {
    expect(nextPlayerPhase("playing", "fatal")).toBe("reconnecting");
  });

  it("does not leave an ended session on recover", () => {
    expect(nextPlayerPhase("ended", "recover")).toBe("ended");
  });
});
