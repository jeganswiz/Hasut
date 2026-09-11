import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
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
}
