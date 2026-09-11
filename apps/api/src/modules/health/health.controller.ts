import { fail, ok, type HealthData } from "@hasut/types";
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { HealthService } from "./health.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Readiness probe (postgres, postgis, redis)" })
  async root(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.writeReady(req, res);
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe (postgres, postgis, redis)" })
  async ready(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.writeReady(req, res);
  }

  @Get("live")
  @ApiOperation({ summary: "Liveness probe (process only)" })
  live(@Req() req: Request, @Res() res: Response): void {
    res.status(HttpStatus.OK).json(ok(this.health.live(), getRequestId(req)));
  }

  private async writeReady(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const data: HealthData = await this.health.ready();
    if (data.status === "ok") {
      res.status(HttpStatus.OK).json(ok(data, requestId));
      return;
    }
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json(
      fail("SERVICE_UNAVAILABLE", "One or more dependencies are down", requestId, {
        health: data,
      }),
    );
  }
}
