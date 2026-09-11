import type { MemberRole } from "@hasut/types";
import { HttpStatus } from "@nestjs/common";
import type { Request } from "express";
import { HasutHttpException } from "../errors/hasut-http.exception";

export interface RequestAuthContext {
  memberId: string;
  sessionId: string;
  roles: MemberRole[];
}

export function getOptionalRequestUser(req: Request): RequestAuthContext | null {
  return (req as Request & { user?: RequestAuthContext }).user ?? null;
}

export function getRequestUser(req: Request): RequestAuthContext {
  const user = (req as Request & { user?: RequestAuthContext }).user;
  if (user === undefined) {
    throw new HasutHttpException(
      "UNAUTHENTICATED",
      "Authentication required",
      HttpStatus.UNAUTHORIZED,
    );
  }
  return user;
}

export function setRequestUser(req: Request, user: RequestAuthContext): void {
  (req as Request & { user: RequestAuthContext }).user = user;
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0]?.trim();
    return first === undefined || first.length === 0 ? null : first;
  }
  return req.ip ?? req.socket.remoteAddress ?? null;
}

export function clientUserAgent(req: Request): string | null {
  const header = req.headers["user-agent"];
  return typeof header === "string" && header.length > 0 ? header : null;
}
