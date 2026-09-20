import type { ReviewAggregateView, ReviewView } from "@hasut/types";
import { reviewWriteSchema } from "@hasut/validation";
import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ReviewsService } from "./reviews.service";

const subjectQuery = z.object({
  subjectType: z.enum(["PROFESSIONAL", "BUSINESS"]),
  subjectId: z.string().uuid(),
});

@ApiTags("reviews")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get("reviews")
  @ApiOperation({ summary: "Public reviews for a professional or business" })
  list(
    @Query(new ZodValidationPipe(subjectQuery)) query: z.infer<typeof subjectQuery>,
  ): Promise<ReviewView[]> {
    return this.reviews.list(query.subjectType, query.subjectId);
  }

  @Public()
  @Get("reviews/aggregate")
  @ApiOperation({ summary: "Review aggregate used by discovery rank" })
  aggregate(
    @Query(new ZodValidationPipe(subjectQuery)) query: z.infer<typeof subjectQuery>,
  ): Promise<ReviewAggregateView> {
    return this.reviews.aggregate(query.subjectType, query.subjectId);
  }

  @ApiBearerAuth()
  @Post("reviews")
  @ApiOperation({ summary: "Write a review for an accepted connection" })
  create(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(reviewWriteSchema)) body: z.infer<typeof reviewWriteSchema>,
    @Req() req: Request,
  ): Promise<ReviewView> {
    return this.reviews.create(memberId, body, getRequestId(req));
  }
}
