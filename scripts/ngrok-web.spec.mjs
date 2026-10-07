import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ngrokHttpArgs } from "./ngrok-web.mjs";

describe("ngrokHttpArgs", () => {
  it("forwards the member web port on loopback", () => {
    assert.deepEqual(ngrokHttpArgs(), ["http", "127.0.0.1:3000"]);
    assert.deepEqual(ngrokHttpArgs(3000), ["http", "127.0.0.1:3000"]);
  });
});
