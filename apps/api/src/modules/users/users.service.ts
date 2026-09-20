import type {
  AdminMemberDetail,
  AdminMemberView,
  CurrentMember,
  MemberRole,
  StaffMemberView,
} from "@hasut/types";
import { MEMBER_ROLES } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Member, MemberRole as MemberRoleRow } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { assertAdminRole } from "../../common/auth/staff-auth";
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

  async countSuspended(): Promise<number> {
    return this.prisma.member.count({ where: { status: "SUSPENDED" } });
  }

  async listStaff(): Promise<StaffMemberView[]> {
    const rows = await this.prisma.member.findMany({
      where: {
        status: "ACTIVE",
        roles: { some: { role: { in: ["ADMIN", "SUPPORT_AGENT"] } } },
      },
      include: { roles: true, profile: true },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      displayName: row.profile?.displayName || "Staff",
      roles: row.roles.map((item) => item.role),
    }));
  }

  async searchMembers(roles: readonly MemberRole[], query: string): Promise<AdminMemberView[]> {
    assertAdminRole(roles);
    const q = query.trim();
    const rows = await this.prisma.member.findMany({
      where:
        q.length === 0
          ? undefined
          : {
              OR: [{ id: q }, { profile: { displayName: { contains: q, mode: "insensitive" } } }],
            },
      include: { roles: true, profile: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((row) => this.toAdminMember(row));
  }

  async getAdminDetail(roles: readonly MemberRole[], memberId: string): Promise<AdminMemberDetail> {
    assertAdminRole(roles);
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { roles: true, profile: true, sessions: { where: { revokedAt: null } } },
    });
    if (member === null) {
      throw new HasutHttpException("NOT_FOUND", "Member not found", HttpStatus.NOT_FOUND);
    }
    return {
      ...this.toAdminMember(member),
      sessionCount: member.sessions.length,
    };
  }

  async setStatus(
    actorId: string,
    roles: readonly MemberRole[],
    memberId: string,
    status: "ACTIVE" | "SUSPENDED",
    requestId: string,
  ): Promise<AdminMemberDetail> {
    assertAdminRole(roles);
    if (actorId === memberId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You cannot change your own account status",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.member.update({
      where: { id: memberId },
      data: { status },
    });
    if (status === "SUSPENDED") {
      await this.prisma.session.updateMany({
        where: { memberId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: status === "SUSPENDED" ? "MEMBER_SUSPENDED" : "MEMBER_RESTORED",
        entity: "member",
        entityId: memberId,
        requestId,
        afterJson: { status },
      },
    });
    return this.getAdminDetail(roles, memberId);
  }

  async revokeSessions(
    actorId: string,
    roles: readonly MemberRole[],
    memberId: string,
    requestId: string,
  ): Promise<AdminMemberDetail> {
    assertAdminRole(roles);
    await this.prisma.session.updateMany({
      where: { memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: "MEMBER_SESSIONS_REVOKED",
        entity: "member",
        entityId: memberId,
        requestId,
      },
    });
    return this.getAdminDetail(roles, memberId);
  }

  async setRoles(
    actorId: string,
    roles: readonly MemberRole[],
    memberId: string,
    nextRoles: readonly MemberRole[],
    requestId: string,
  ): Promise<AdminMemberDetail> {
    assertAdminRole(roles);
    if (actorId === memberId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You cannot change your own roles",
        HttpStatus.BAD_REQUEST,
      );
    }
    const unique = [...new Set(["MEMBER" as const, ...nextRoles])].filter((role) =>
      MEMBER_ROLES.includes(role),
    );
    await this.prisma.$transaction([
      this.prisma.memberRole.deleteMany({ where: { memberId } }),
      this.prisma.memberRole.createMany({
        data: unique.map((role) => ({ memberId, role })),
      }),
    ]);
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: "MEMBER_ROLES_UPDATED",
        entity: "member",
        entityId: memberId,
        requestId,
        afterJson: { roles: unique },
      },
    });
    return this.getAdminDetail(roles, memberId);
  }

  private toAdminMember(row: {
    id: string;
    status: string;
    createdAt: Date;
    roles: Array<{ role: string }>;
    profile: { displayName: string } | null;
  }): AdminMemberView {
    return {
      id: row.id,
      displayName: row.profile?.displayName || "Member",
      status: row.status,
      roles: row.roles.map((item) => item.role),
      createdAt: row.createdAt.toISOString(),
    };
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
