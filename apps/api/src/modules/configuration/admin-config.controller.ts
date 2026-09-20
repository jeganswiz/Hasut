import type { FeatureFlagAdminView, ThemeEditorView, ThemeTokens } from "@hasut/types";
import { THEME_TOKEN_KEYS } from "@hasut/types";
import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ConfigurationService } from "./configuration.service";

const themeDraftSchema = z.object({
  tokens: z.object(
    Object.fromEntries(THEME_TOKEN_KEYS.map((key) => [key, z.string().min(1)])) as Record<
      (typeof THEME_TOKEN_KEYS)[number],
      z.ZodString
    >,
  ),
});

const flagPatchSchema = z.object({
  enabled: z.boolean(),
});

@ApiTags("admin-config")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin")
export class AdminConfigController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get("theme")
  @ApiOperation({ summary: "Theme editor payload with contrast warnings" })
  theme(): Promise<ThemeEditorView> {
    return this.configuration.getThemeEditor();
  }

  @Post("theme/draft")
  @ApiOperation({ summary: "Save a theme draft" })
  draft(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(themeDraftSchema)) body: { tokens: ThemeTokens },
    @Req() req: Request,
  ): Promise<ThemeEditorView> {
    return this.configuration.saveThemeDraft(user.memberId, body.tokens, getRequestId(req));
  }

  @Post("theme/publish")
  @ApiOperation({ summary: "Publish theme and bust cache" })
  publish(@CurrentUser() user: RequestAuthContext, @Req() req: Request): Promise<ThemeEditorView> {
    return this.configuration.publishTheme(user.memberId, getRequestId(req));
  }

  @Get("flags")
  @ApiOperation({ summary: "Feature flags" })
  flags(): Promise<FeatureFlagAdminView[]> {
    return this.configuration.listFlags();
  }

  @Patch("flags/:key")
  @ApiOperation({ summary: "Toggle a feature flag" })
  updateFlag(
    @CurrentUser() user: RequestAuthContext,
    @Param("key") key: string,
    @Body(new ZodValidationPipe(flagPatchSchema)) body: { enabled: boolean },
    @Req() req: Request,
  ): Promise<FeatureFlagAdminView> {
    return this.configuration.updateFlag(user.memberId, key, body.enabled, getRequestId(req));
  }
}
