import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuditLogView, MemberRole } from "@hasut/types";
import { assertAdminRole } from "../../common/auth/staff-auth";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditRecordInput {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  beforeJson?: Prisma.InputJsonValue;
  afterJson?: Prisma.InputJsonValue;
  ip?: string | null;
  requestId: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        beforeJson: input.beforeJson,
        afterJson: input.afterJson,
        ip: input.ip ?? null,
        requestId: input.requestId,
      },
    });
  }

  async list(
    roles: readonly MemberRole[],
    filters: { entity?: string; actorId?: string; requestId?: string },
  ): Promise<AuditLogView[]> {
    assertAdminRole(roles);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entity: filters.entity,
        actorId: filters.actorId,
        requestId: filters.requestId,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
