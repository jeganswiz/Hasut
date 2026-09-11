import { ConfigService } from "@nestjs/config";
import type { Provider } from "@nestjs/common";
import type { ApiEnv } from "../../../config/env";
import { ConsoleOtpProvider } from "./console-otp.provider";
import { Msg91OtpProvider } from "./msg91-otp.provider";
import { OTP_PROVIDER } from "./otp-provider";
import { TwilioOtpProvider } from "./twilio-otp.provider";

export const otpProviderFactory: Provider = {
  provide: OTP_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<ApiEnv, true>) => {
    const name = config.get("OTP_PROVIDER", { infer: true });
    if (name === "msg91") {
      return new Msg91OtpProvider(config);
    }
    if (name === "twilio") {
      return new TwilioOtpProvider();
    }
    return new ConsoleOtpProvider();
  },
};
