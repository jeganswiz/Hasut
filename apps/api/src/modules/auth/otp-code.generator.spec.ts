import { OtpCodeGenerator } from "./otp-code.generator";

describe("OtpCodeGenerator", () => {
  it("returns the configured development code for the console provider", () => {
    const config = {
      get: (key: string) => {
        if (key === "NODE_ENV") {
          return "development";
        }
        if (key === "OTP_PROVIDER") {
          return "console";
        }
        if (key === "DEV_OTP_CODE") {
          return "123456";
        }
        return "";
      },
    };
    const generator = new OtpCodeGenerator(config as never);
    expect(generator.generate(6)).toBe("123456");
  });
});
