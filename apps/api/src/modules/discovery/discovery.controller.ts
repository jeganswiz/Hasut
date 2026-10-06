import type {
  DiscoveryKind,
  DiscoveryPolicyView,
  DiscoveryPreview,
  DiscoveryRankingWeightsView,
  DiscoveryResult,
  DiscoveryRoute,
} from "@hasut/types";
import {
  discoveryPolicyPatchSchema,
  discoveryQuerySchema,
  discoveryRankingPatchSchema,
  discoveryRouteRequestSchema,
} from "@hasut/validation";
import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { OptionalUser } from "../../common/decorators/optional-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ConfigurationService } from "../configuration/configuration.service";
import { DiscoveryService } from "./discovery.service";

type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;
type DiscoveryRouteRequest = z.infer<typeof discoveryRouteRequestSchema>;
type PolicyPatch = z.infer<typeof discoveryPolicyPatchSchema>;
type RankingPatch = z.infer<typeof discoveryRankingPatchSchema>;

@ApiTags("discovery")
@Controller()
export class DiscoveryController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly configuration: ConfigurationService,
  ) {}

  @Public()
  @Get("discovery/nearby")
  @ApiOperation({ summary: "Ranked nearby people, professionals, and businesses" })
  nearby(
    @OptionalUser("memberId") memberId: string | null,
    @Query(new ZodValidationPipe(discoveryQuerySchema)) query: DiscoveryQuery,
  ): Promise<DiscoveryResult> {
    return this.discovery.nearby(memberId, query);
  }

  @Public()
  @Post("discovery/route")
  @ApiOperation({ summary: "Road path from the viewer to a public discovery pin" })
  route(
    @OptionalUser("memberId") memberId: string | null,
    @Body(new ZodValidationPipe(discoveryRouteRequestSchema)) body: DiscoveryRouteRequest,
  ): Promise<DiscoveryRoute> {
    return this.discovery.routeTo(memberId, body);
  }

  @Public()
  @Get("discovery/search")
  @ApiOperation({ summary: "Keyword search over nearby discovery results" })
  search(
    @OptionalUser("memberId") memberId: string | null,
    @Query(new ZodValidationPipe(discoveryQuerySchema)) query: DiscoveryQuery,
  ): Promise<DiscoveryResult> {
    return this.discovery.search(memberId, query);
  }

  @Public()
  @Get("discovery/preview/:kind/:id")
  @ApiOperation({ summary: "Preview a nearby discovery result" })
  preview(
    @OptionalUser("memberId") memberId: string | null,
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(discoveryQuerySchema)) query: DiscoveryQuery,
  ): Promise<DiscoveryPreview> {
    const parsedKind = z.enum(["MEMBER", "PROFESSIONAL", "BUSINESS"]).parse(kind) as DiscoveryKind;
    return this.discovery.preview(memberId, parsedKind, id, query);
  }

  @Public()
  @Get("config/discovery")
  @ApiOperation({ summary: "Public discovery defaults from admin configuration" })
  policy(): Promise<DiscoveryPolicyView> {
    return this.discovery.publicPolicy();
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Get("admin/discovery/policy")
  @ApiOperation({ summary: "Admin discovery policy" })
  adminPolicy(): Promise<DiscoveryPolicyView> {
    return this.configuration.getPublicDiscoveryPolicy();
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Patch("admin/discovery/policy")
  @ApiOperation({ summary: "Update discovery defaults" })
  patchPolicy(
    @Body(new ZodValidationPipe(discoveryPolicyPatchSchema)) body: PolicyPatch,
  ): Promise<DiscoveryPolicyView> {
    return this.configuration
      .updateDiscoveryPolicy(body)
      .then(() => this.configuration.getPublicDiscoveryPolicy());
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Get("admin/discovery/weights")
  @ApiOperation({ summary: "Active discovery ranking weights" })
  weights(): Promise<DiscoveryRankingWeightsView> {
    return this.configuration.getDiscoveryRankingWeights();
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Patch("admin/discovery/weights")
  @ApiOperation({ summary: "Replace active discovery ranking weights" })
  patchWeights(
    @Body(new ZodValidationPipe(discoveryRankingPatchSchema)) body: RankingPatch,
  ): Promise<DiscoveryRankingWeightsView> {
    return this.configuration.updateDiscoveryRankingWeights(body);
  }
}
