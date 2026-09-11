import type { CategoryAppliesTo, CategoryView } from "@hasut/types";
import { categoryPatchSchema, categoryWriteSchema } from "@hasut/validation";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CategoriesService } from "./categories.service";

type CategoryWriteBody = z.infer<typeof categoryWriteSchema>;
type CategoryPatchBody = z.infer<typeof categoryPatchSchema>;

const appliesToQuerySchema = z.enum(["PROFESSIONAL", "BUSINESS", "SERVICE", "ALL"]).optional();

@ApiTags("categories")
@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get("categories")
  @ApiOperation({ summary: "Active category tree from the database" })
  listPublic(@Query("appliesTo") appliesTo?: string): Promise<CategoryView[]> {
    const parsed = appliesToQuerySchema.parse(
      appliesTo === undefined || appliesTo === "" ? undefined : appliesTo,
    );
    return this.categories.listPublic(parsed as CategoryAppliesTo | undefined);
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Get("admin/categories")
  @ApiOperation({ summary: "Admin category tree including inactive nodes" })
  listAdmin(): Promise<CategoryView[]> {
    return this.categories.listAdmin();
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Post("admin/categories")
  @ApiOperation({ summary: "Create a category" })
  create(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(categoryWriteSchema)) body: CategoryWriteBody,
    @Req() req: Request,
  ): Promise<CategoryView> {
    return this.categories.create(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Patch("admin/categories/:id")
  @ApiOperation({ summary: "Update a category" })
  update(
    @CurrentUser("memberId") memberId: string,
    @Param("id") categoryId: string,
    @Body(new ZodValidationPipe(categoryPatchSchema)) body: CategoryPatchBody,
    @Req() req: Request,
  ): Promise<CategoryView> {
    return this.categories.update(memberId, categoryId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Delete("admin/categories/:id")
  @ApiOperation({ summary: "Delete a category, or deactivate it when it is in use" })
  remove(
    @CurrentUser("memberId") memberId: string,
    @Param("id") categoryId: string,
    @Req() req: Request,
  ): Promise<CategoryView> {
    return this.categories.remove(memberId, categoryId, getRequestId(req));
  }
}
