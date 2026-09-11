import type { OwnerProfessional, ProfessionalOnboarding, PublicProfessional } from "@hasut/types";
import {
  onboardingCategoriesSchema,
  onboardingProfileSchema,
  onboardingServiceAreaSchema,
  professionalStatusPatchSchema,
} from "@hasut/validation";
import { Body, Controller, Get, Param, Patch, Post, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ProfessionalsService } from "./professionals.service";

type OnboardingCategoriesBody = z.infer<typeof onboardingCategoriesSchema>;
type OnboardingProfileBody = z.infer<typeof onboardingProfileSchema>;
type OnboardingServiceAreaBody = z.infer<typeof onboardingServiceAreaSchema>;
type ProfessionalStatusBody = z.infer<typeof professionalStatusPatchSchema>;

@ApiTags("professionals")
@Controller()
export class ProfessionalsController {
  constructor(private readonly professionals: ProfessionalsService) {}

  @ApiBearerAuth()
  @Get("me/professional/onboarding")
  @ApiOperation({ summary: "Professional onboarding state, categories, and availability options" })
  getOnboarding(@CurrentUser("memberId") memberId: string): Promise<ProfessionalOnboarding> {
    return this.professionals.getOnboarding(memberId);
  }

  @ApiBearerAuth()
  @Post("me/professional/onboarding/start")
  @ApiOperation({ summary: "Start professional onboarding" })
  start(
    @CurrentUser("memberId") memberId: string,
    @Req() req: Request,
  ): Promise<ProfessionalOnboarding> {
    return this.professionals.start(memberId, getRequestId(req));
  }

  @ApiBearerAuth()
  @Put("me/professional/onboarding/categories")
  @ApiOperation({ summary: "Select professional categories" })
  saveCategories(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(onboardingCategoriesSchema)) body: OnboardingCategoriesBody,
    @Req() req: Request,
  ): Promise<ProfessionalOnboarding> {
    return this.professionals.saveCategories(memberId, body.categoryIds, getRequestId(req));
  }

  @ApiBearerAuth()
  @Put("me/professional/onboarding/profile")
  @ApiOperation({ summary: "Save professional information, skills, and availability" })
  saveProfile(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(onboardingProfileSchema)) body: OnboardingProfileBody,
    @Req() req: Request,
  ): Promise<ProfessionalOnboarding> {
    return this.professionals.saveProfile(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Put("me/professional/onboarding/service-area")
  @ApiOperation({ summary: "Set professional service area" })
  saveServiceArea(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(onboardingServiceAreaSchema)) body: OnboardingServiceAreaBody,
    @Req() req: Request,
  ): Promise<ProfessionalOnboarding> {
    return this.professionals.saveServiceArea(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Post("me/professional/onboarding/submit")
  @ApiOperation({ summary: "Submit professional onboarding" })
  submit(
    @CurrentUser("memberId") memberId: string,
    @Req() req: Request,
  ): Promise<ProfessionalOnboarding> {
    return this.professionals.submit(memberId, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("me/professional")
  @ApiOperation({ summary: "Current member professional profile" })
  getMine(@CurrentUser("memberId") memberId: string): Promise<OwnerProfessional> {
    return this.professionals.getMine(memberId);
  }

  @ApiBearerAuth()
  @Patch("me/professional")
  @ApiOperation({ summary: "Pause or resume a submitted professional profile" })
  patchMine(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(professionalStatusPatchSchema)) body: ProfessionalStatusBody,
    @Req() req: Request,
  ): Promise<OwnerProfessional> {
    return this.professionals.patchStatus(memberId, body.status, getRequestId(req));
  }

  @Public()
  @Get("professionals/:id")
  @ApiOperation({ summary: "Public professional profile without exact coordinates" })
  getPublic(@Param("id") professionalId: string): Promise<PublicProfessional> {
    return this.professionals.getPublic(professionalId);
  }
}
