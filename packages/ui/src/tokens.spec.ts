import { THEME_CSS_VARIABLES } from "@hasut/config";
import { cssVar } from "./tokens";

describe("cssVar", () => {
  it("returns a CSS variable reference for a token", () => {
    expect(cssVar("primary")).toBe(`var(${THEME_CSS_VARIABLES.primary})`);
  });
});
