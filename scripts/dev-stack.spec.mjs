import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDevDownArgs, parseDevUpArgs } from "./dev-stack.mjs";

describe("parseDevUpArgs", () => {
  it("defaults to migrate/seed as needed and start apps", () => {
    assert.deepEqual(parseDevUpArgs([]), {
      skipSeed: false,
      forceSeed: false,
      infraOnly: false,
      skipInstall: false,
    });
  });

  it("accepts kickoff flags", () => {
    assert.deepEqual(parseDevUpArgs(["--skip-seed", "--infra-only", "--skip-install"]), {
      skipSeed: true,
      forceSeed: false,
      infraOnly: true,
      skipInstall: true,
    });
    assert.equal(parseDevUpArgs(["--seed"]).forceSeed, true);
  });
});

describe("parseDevDownArgs", () => {
  it("leaves Docker data stores running unless --infra is passed", () => {
    assert.deepEqual(parseDevDownArgs([]), { infra: false });
    assert.deepEqual(parseDevDownArgs(["--infra"]), { infra: true });
  });
});
