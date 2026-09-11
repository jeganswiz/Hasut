import type { CurrentMember, MemberRole } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Member, MemberRole as MemberRoleRow } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { PrismaService } from "../prisma/prisma.service";

type MemberWithRoles = Member & { roles: MemberRoleRow[] };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(memberId: string): Promise<CurrentMember> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { roles: true },
    });
    if (member === null) {
      throw new HasutHttpException("NOT_FOUND", "Member not found", HttpStatus.NOT_FOUND);
    }
    return this.toCurrentMember(member);
  }

  async upsertByPhone(phoneE164: string): Promise<CurrentMember> {
    const existing = await this.prisma.member.findUnique({
      where: { phoneE164 },
      include: { roles: true },
    });
    if (existing !== null) {
      if (existing.status !== "ACTIVE") {
        throw new HasutHttpException(
          "ACCOUNT_SUSPENDED",
          "This account cannot sign in",
          HttpStatus.FORBIDDEN,
        );
      }
      if (!existing.roles.some((row) => row.role === "MEMBER")) {
        await this.prisma.memberRole.create({
          data: { memberId: existing.id, role: "MEMBER" },
        });
        return this.getCurrent(existing.id);
      }
      return this.toCurrentMember(existing);
    }

    const created = await this.prisma.member.create({
      data: {
        phoneE164,
        roles: { create: { role: "MEMBER" } },
      },
      include: { roles: true },
    });
    return this.toCurrentMember(created);
  }

  toCurrentMember(member: MemberWithRoles): CurrentMember {
    return {
      id: member.id,
      phoneE164: member.phoneE164,
      status: member.status,
      roles: member.roles.map((row) => row.role as MemberRole),
      createdAt: member.createdAt.toISOString(),
    };
  }
}
