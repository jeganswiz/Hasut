import type { OwnerLocation } from "@hasut/types";
import { locationPermissionSchema, locationUpdateSchema } from "@hasut/validation";
import { Body, Controller, Get, Patch, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { LocationsService } from "./locations.service";

type LocationUpdateBody = z.infer<typeof locationUpdateSchema>;
type LocationPermissionBody = z.infer<typeof locationPermissionSchema>;

@ApiTags("me")
@ApiBearerAuth()
@Controller("me")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get("location")
  @ApiOperation({ summary: "Owner exact location plus public approximation" })
  getLocation(@CurrentUser("memberId") memberId: string): Promise<OwnerLocation> {
    return this.locations.getOwnerLocation(memberId);
  }

  @Put("location")
  @ApiOperation({ summary: "Update the member exact location after permission is granted" })
  updateLocation(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(locationUpdateSchema)) body: LocationUpdateBody,
    @Req() req: Request,
  ): Promise<OwnerLocation> {
    return this.locations.updateExactLocation(memberId, body, getRequestId(req));
  }

  @Patch("location/permission")
  @ApiOperation({ summary: "Record the client location permission decision" })
  setPermission(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(locationPermissionSchema)) body: LocationPermissionBody,
    @Req() req: Request,
  ): Promise<OwnerLocation> {
    return this.locations.setPermission(memberId, body.status, getRequestId(req));
  }
}
