import { clearAllVisits, readVisit, writeVisit } from "./visit-cache";

describe("visit cache", () => {
  afterEach(() => {
    clearAllVisits();
  });

  it("returns the last successful payload for a route", () => {
    expect(readVisit<string[]>("/inbox")).toBeUndefined();
    writeVisit("/inbox", [{ id: "c1" }]);
    expect(readVisit<Array<{ id: string }>>("/inbox")).toEqual([{ id: "c1" }]);
  });

  it("replaces a route payload on pull-to-refresh", () => {
    writeVisit("/live", { liveNow: [{ id: "old" }] });
    writeVisit("/live", { liveNow: [{ id: "new" }] });
    expect(readVisit<{ liveNow: Array<{ id: string }> }>("/live")).toEqual({
      liveNow: [{ id: "new" }],
    });
  });

  it("lets a cache hit skip the empty loading copy", () => {
    writeVisit("/inbox", { items: [{ id: "c1" }], state: "success", message: "1 conversations" });
    const cached = readVisit<{ message: string }>("/inbox");
    expect(cached?.message).not.toMatch(/Loading/);
  });
});
