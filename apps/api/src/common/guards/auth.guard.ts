import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { setRequestUser } from "../auth/request-auth";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { HasutHttpException } from "../errors/hasut-http.exception";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { TokenService } from "../../modules/auth/token.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request>();
    if (isPublic === true) {
      if (request.headers.authorization?.startsWith("Bearer ") === true) {
        try {
          await this.authenticate(request);
        } catch {
          // Public routes stay available when a leftover token is invalid.
        }
      }
      return true;
    }

    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith("Bearer ")) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "Authentication required",
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.authenticate(request);
    return true;
  }

  private async authenticate(request: Request): Promise<void> {
    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith("Bearer ")) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "Authentication required",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const claims = this.tokens.verifyAccess(header.slice("Bearer ".length));
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      include: { member: { include: { roles: true } } },
    });
    if (session === null || session.memberId !== claims.sub) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "Authentication required",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      throw new HasutHttpException(
        "SESSION_REVOKED",
        "Session has been revoked",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (session.member.status !== "ACTIVE") {
      throw new HasutHttpException(
        "ACCOUNT_SUSPENDED",
        "This account cannot sign in",
        HttpStatus.FORBIDDEN,
      );
    }

    setRequestUser(request, {
      memberId: session.memberId,
      sessionId: session.id,
      roles: session.member.roles.map((row) => row.role),
    });
  }
}
