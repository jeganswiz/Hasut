import type { CategoryAppliesTo, CategoryView } from "@hasut/types";
import { slugify } from "@hasut/utils";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

export interface CategoryWriteInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  appliesTo?: CategoryAppliesTo;
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublic(appliesTo?: CategoryAppliesTo): Promise<CategoryView[]> {
    const rows = await this.prisma.category.findMany({
      where: {
        isActive: true,
        ...(appliesTo === undefined ? {} : { appliesTo: { in: [appliesTo, "ALL"] } }),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return this.toTree(rows);
  }

  async listAdmin(): Promise<CategoryView[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return this.toTree(rows);
  }

  async create(
    actorId: string,
    input: CategoryWriteInput,
    requestId: string,
  ): Promise<CategoryView> {
    const slug = this.resolveSlug(input.name, input.slug);
    await this.assertSlugAvailable(slug);
    await this.assertParentExists(input.parentId ?? null);

    const created = await this.prisma.category.create({
      data: {
        name: input.name,
        slug,
        parentId: input.parentId ?? null,
        appliesTo: input.appliesTo ?? "ALL",
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 100,
      },
    });
    await this.audit.record({
      actorId,
      action: "CATEGORY_CREATED",
      entity: "category",
      entityId: created.id,
      requestId,
      afterJson: { slug: created.slug, parentId: created.parentId },
    });
    return this.getView(created.id);
  }

  async update(
    actorId: string,
    categoryId: string,
    input: Partial<CategoryWriteInput>,
    requestId: string,
  ): Promise<CategoryView> {
    const existing = await this.requireCategory(categoryId);
    const nextName = input.name ?? existing.name;
    const slug =
      input.slug !== undefined || input.name !== undefined
        ? this.resolveSlug(
            nextName,
            input.slug ?? (input.name === undefined ? existing.slug : undefined),
          )
        : existing.slug;
    if (slug !== existing.slug) {
      await this.assertSlugAvailable(slug, categoryId);
    }

    const parentId = input.parentId === undefined ? existing.parentId : input.parentId;
    if (parentId !== existing.parentId) {
      await this.assertParentExists(parentId);
      await this.assertNoCycle(categoryId, parentId);
    }

    await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: nextName,
        slug,
        parentId,
        appliesTo: input.appliesTo ?? existing.appliesTo,
        isActive: input.isActive ?? existing.isActive,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
    });
    await this.audit.record({
      actorId,
      action: "CATEGORY_UPDATED",
      entity: "category",
      entityId: categoryId,
      requestId,
      afterJson: { slug, parentId },
    });
    return this.getView(categoryId);
  }

  async remove(actorId: string, categoryId: string, requestId: string): Promise<CategoryView> {
    await this.requireCategory(categoryId);
    const [childCount, usageCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: categoryId } }),
      this.prisma.professionalCategory.count({ where: { categoryId } }),
    ]);

    if (childCount > 0 || usageCount > 0) {
      const deactivated = await this.prisma.category.update({
        where: { id: categoryId },
        data: { isActive: false },
      });
      await this.audit.record({
        actorId,
        action: "CATEGORY_DEACTIVATED",
        entity: "category",
        entityId: categoryId,
        requestId,
        afterJson: { childCount, usageCount },
      });
      return this.toView(deactivated, []);
    }

    const deleted = await this.prisma.category.delete({ where: { id: categoryId } });
    await this.audit.record({
      actorId,
      action: "CATEGORY_DELETED",
      entity: "category",
      entityId: categoryId,
      requestId,
    });
    return this.toView(deleted, []);
  }

  async requireAssignable(categoryIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(categoryIds)];
    const rows = await this.prisma.category.findMany({
      where: { id: { in: uniqueIds }, isActive: true, appliesTo: { in: ["PROFESSIONAL", "ALL"] } },
    });
    if (rows.length !== uniqueIds.length) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "One or more categories are invalid for professionals",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getView(categoryId: string): Promise<CategoryView> {
    const row = await this.requireCategory(categoryId);
    const children = await this.prisma.category.findMany({
      where: { parentId: categoryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return this.toView(
      row,
      children.map((child) => this.toView(child, [])),
    );
  }

  private async requireCategory(categoryId: string): Promise<Category> {
    const row = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Category not found", HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async assertParentExists(parentId: string | null): Promise<void> {
    if (parentId === null) {
      return;
    }
    await this.requireCategory(parentId);
  }

  private async assertNoCycle(categoryId: string, parentId: string | null): Promise<void> {
    if (parentId === null) {
      return;
    }
    if (parentId === categoryId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "A category cannot be its own parent",
        HttpStatus.BAD_REQUEST,
      );
    }
    let currentId: string | null = parentId;
    const seen = new Set<string>([categoryId]);
    while (currentId !== null) {
      if (seen.has(currentId)) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Category parent would create a cycle",
          HttpStatus.BAD_REQUEST,
        );
      }
      seen.add(currentId);
      const current: Category | null = await this.prisma.category.findUnique({
        where: { id: currentId },
      });
      currentId = current?.parentId ?? null;
    }
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing !== null && existing.id !== exceptId) {
      throw new HasutHttpException("CONFLICT", "Category slug already exists", HttpStatus.CONFLICT);
    }
  }

  private resolveSlug(name: string, slug?: string): string {
    const resolved = slugify(slug ?? name);
    if (resolved.length === 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Category slug cannot be empty",
        HttpStatus.BAD_REQUEST,
      );
    }
    return resolved;
  }

  private toTree(rows: Category[]): CategoryView[] {
    const nodes = new Map<string, CategoryView>();
    for (const row of rows) {
      nodes.set(row.id, this.toView(row, []));
    }
    const roots: CategoryView[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id);
      if (node === undefined) {
        continue;
      }
      if (row.parentId !== null && nodes.has(row.parentId)) {
        nodes.get(row.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  private toView(row: Category, children: CategoryView[]): CategoryView {
    return {
      id: row.id,
      parentId: row.parentId,
      slug: row.slug,
      name: row.name,
      appliesTo: row.appliesTo,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      children,
    };
  }
}
