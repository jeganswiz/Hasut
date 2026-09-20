import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../../config/env";
import { ConsoleEmailProvider } from "./console-email.provider";
import { EMAIL_PROVIDER } from "./email-provider";
import { SmtpEmailProvider } from "./smtp-email.provider";

export const emailProviderFactory: Provider = {
  provide: EMAIL_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<ApiEnv, true>) => {
    if (config.get("EMAIL_PROVIDER", { infer: true }) === "smtp") {
      return new SmtpEmailProvider(config);
    }
    return new ConsoleEmailProvider();
  },
};
