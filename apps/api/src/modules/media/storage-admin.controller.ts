import type { StorageOverview, StorageSwitchResult } from "@hasut/types";
import { storageSwitchSchema } from "@hasut/validation";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { StorageAdminService } from "./storage-admin.service";

type SwitchBody = z.infer<typeof storageSwitchSchema>;

@ApiTags("admin-storage")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin/storage")
export class StorageAdminController {
  constructor(private readonly storage: StorageAdminService) {}

  @Get()
  @ApiOperation({ summary: "Active storage, saved backends, and the latest transfer" })
  overview(): Promise<StorageOverview> {
    return this.storage.overview();
  }

  @Post("switch")
  @ApiOperation({
    summary: "Test a storage backend and switch, asking before an existing-file transfer",
  })
  switchTo(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(storageSwitchSchema)) body: SwitchBody,
    @Req() req: Request,
  ): Promise<StorageSwitchResult> {
    return this.storage.switchTo(user.memberId, body, getRequestId(req));
  }

  @Post("migrations/:id/cancel")
  @ApiOperation({ summary: "Stop a running transfer. Copied files stay on the destination." })
  cancel(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<StorageOverview> {
    return this.storage.cancel(user.memberId, id, getRequestId(req));
  }

  @Post("migrations/:id/retry")
  @ApiOperation({ summary: "Resume a failed or cancelled transfer" })
  retry(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<StorageOverview> {
    return this.storage.retry(user.memberId, id, getRequestId(req));
  }
}
