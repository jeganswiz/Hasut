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
      this.assertSignInAllowed(existing);
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

  /** Email OTP proves inbox control, so the address lands verified. */
  async upsertByEmail(email: string): Promise<CurrentMember> {
    const existing = await this.findByEmail(email);
    if (existing !== null) {
      this.assertSignInAllowed(existing);
      if (existing.emailVerifiedAt === null) {
        const updated = await this.prisma.member.update({
          where: { id: existing.id },
          data: { emailVerifiedAt: new Date() },
          include: { roles: true },
        });
        return this.toCurrentMember(updated);
      }
      return this.toCurrentMember(existing);
    }

    const created = await this.prisma.member.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        roles: { create: { role: "MEMBER" } },
        profile: { create: { displayName: "Member" } },
      },
      include: { roles: true },
    });
    return this.toCurrentMember(created);
  }

  /** Raw row for auth use cases that need the password hash. Never returned to clients. */
  async findByEmail(email: string): Promise<MemberWithRoles | null> {
    return this.prisma.member.findUnique({ where: { email }, include: { roles: true } });
  }

  async findWithRoles(memberId: string): Promise<MemberWithRoles | null> {
    return this.prisma.member.findUnique({ where: { id: memberId }, include: { roles: true } });
  }

  async findByPhone(phoneE164: string): Promise<MemberWithRoles | null> {
    return this.prisma.member.findUnique({ where: { phoneE164 }, include: { roles: true } });
  }

  assertSignInAllowed(member: { status: string }): void {
    if (member.status !== "ACTIVE") {
      throw new HasutHttpException(
        "ACCOUNT_SUSPENDED",
        "This account cannot sign in",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async createWithEmail(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    phoneE164?: string;
    emailVerified: boolean;
  }): Promise<MemberWithRoles> {
    return this.prisma.member.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        passwordUpdatedAt: new Date(),
        emailVerifiedAt: input.emailVerified ? new Date() : null,
        phoneE164: input.phoneE164 ?? null,
        roles: { create: { role: "MEMBER" } },
        profile: { create: { displayName: input.displayName } },
      },
      include: { roles: true },
    });
  }

  /**
   * Links a verified third-party account to one Member, creating the Member
   * only when the provider vouches for an unseen verified email.
   */
  async upsertBySsoIdentity(input: {
    provider: "GOOGLE" | "FACEBOOK";
    providerAccountId: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
  }): Promise<MemberWithRoles> {
    const linked = await this.prisma.memberIdentity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      },
      include: { member: { include: { roles: true } } },
    });
    if (linked !== null) {
      this.assertSignInAllowed(linked.member);
      await this.prisma.memberIdentity.update({
        where: { id: linked.id },
        data: { lastLoginAt: new Date() },
      });
      return linked.member;
    }

    // Only an email the provider itself verified may claim an existing account.
    const claimable =
      input.emailVerified && input.email !== null ? await this.findByEmail(input.email) : null;
    if (claimable !== null) {
      this.assertSignInAllowed(claimable);
      await this.prisma.memberIdentity.create({
        data: {
          memberId: claimable.id,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          email: input.email,
          lastLoginAt: new Date(),
        },
      });
      return claimable;
    }

    if (!input.emailVerified || input.email === null) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "This provider did not share a verified email address",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.member.create({
      data: {
        email: input.email,
        emailVerifiedAt: new Date(),
        roles: { create: { role: "MEMBER" } },
        profile: { create: { displayName: input.displayName?.trim() || "Member" } },
        identities: {
          create: {
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            email: input.email,
            lastLoginAt: new Date(),
          },
        },
      },
      include: { roles: true },
    });
  }

  async setTwoFactor(memberId: string, enabled: boolean): Promise<CurrentMember> {
    const member = await this.prisma.member.update({
      where: { id: memberId },
      data: { twoFactorEnabled: enabled },
      include: { roles: true },
    });
    return this.toCurrentMember(member);
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
      email: member.email,
      emailVerified: member.emailVerifiedAt !== null,
      hasPassword: member.passwordHash !== null,
      twoFactorEnabled: member.twoFactorEnabled,
      status: member.status,
      roles: member.roles.map((row) => row.role as MemberRole),
      createdAt: member.createdAt.toISOString(),
    };
  }
}
