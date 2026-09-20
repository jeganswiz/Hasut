import { passwordStrength, PASSWORD_MIN_LENGTH } from "./password";

describe("passwordStrength", () => {
  it("rates anything under the floor as weak", () => {
    expect("Ab3!x".length).toBeLessThan(PASSWORD_MIN_LENGTH);
    expect(passwordStrength("Ab3!x")).toBe("weak");
  });

  it("rates a long mixed passphrase as strong", () => {
    expect(passwordStrength("Chennai-Patron-42")).toBe("strong");
  });

  it("rates a long but predictable password as weak", () => {
    expect(passwordStrength("password12345")).toBe("weak");
  });
});
