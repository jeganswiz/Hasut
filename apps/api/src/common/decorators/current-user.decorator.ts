import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { getRequestUser, type RequestAuthContext } from "../auth/request-auth";

export const CurrentUser = createParamDecorator(
  (field: keyof RequestAuthContext | undefined, ctx: ExecutionContext): unknown => {
    const user = getRequestUser(ctx.switchToHttp().getRequest<Request>());
    return field === undefined ? user : user[field];
  },
);
