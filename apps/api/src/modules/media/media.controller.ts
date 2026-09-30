import type { MediaAssetView, MediaPresignResult } from "@hasut/types";
import { mediaCompleteSchema, mediaPresignSchema } from "@hasut/validation";
import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MediaService } from "./media.service";

type PresignBody = z.infer<typeof mediaPresignSchema>;
type CompleteBody = z.infer<typeof mediaCompleteSchema>;

@ApiTags("media")
@ApiBearerAuth()
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("presign")
  @ApiOperation({ summary: "Create a pending media object and a short-lived upload URL" })
  presign(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(mediaPresignSchema)) body: PresignBody,
    @Req() req: Request,
  ): Promise<MediaPresignResult> {
    return this.media.presign(memberId, body, getRequestId(req), requestPublicOrigin(req));
  }

  @Post("complete")
  @ApiOperation({ summary: "Mark an uploaded media object as ready after server-side checks" })
  complete(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(mediaCompleteSchema)) body: CompleteBody,
    @Req() req: Request,
  ): Promise<MediaAssetView> {
    return this.media.complete(memberId, body.mediaId, getRequestId(req));
  }
}

function requestPublicOrigin(req: Request): string | null {
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (host === undefined || host.trim().length === 0) {
    return null;
  }
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwarded === "string" && forwarded.length > 0
      ? forwarded.split(",")[0]?.trim()
      : req.protocol;
  if (proto !== "http" && proto !== "https") {
    return null;
  }
  return `${proto}://${host}`;
}
