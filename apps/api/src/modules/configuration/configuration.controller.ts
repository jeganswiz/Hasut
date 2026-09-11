import type {
  MessagingPolicyView,
  PublicFlagsConfig,
  PublicThemeConfig,
  ReportsPolicyView,
} from "@hasut/types";
import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { ConfigurationService } from "./configuration.service";

@ApiTags("config")
@Public()
@Controller("config")
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get("theme")
  @ApiOperation({ summary: "Published theme tokens" })
  theme(): Promise<PublicThemeConfig> {
    return this.configuration.getPublicTheme();
  }

  @Get("flags")
  @ApiOperation({ summary: "Public feature flags" })
  flags(): Promise<PublicFlagsConfig> {
    return this.configuration.getPublicFlags();
  }

  @Get("messaging")
  @ApiOperation({ summary: "Public messaging defaults" })
  messaging(): Promise<MessagingPolicyView> {
    return this.configuration.getPublicMessagingPolicy();
  }

  @Get("reports")
  @ApiOperation({ summary: "Public report reason catalog" })
  reports(): Promise<ReportsPolicyView> {
    return this.configuration.getPublicReportsPolicy();
  }
}
