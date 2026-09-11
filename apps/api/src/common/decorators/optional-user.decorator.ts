import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { getOptionalRequestUser, type RequestAuthContext } from "../auth/request-auth";

export const OptionalUser = createParamDecorator(
  (field: keyof RequestAuthContext | undefined, ctx: ExecutionContext): unknown => {
    const user = getOptionalRequestUser(ctx.switchToHttp().getRequest<Request>());
    if (user === null) {
      return null;
    }
    return field === undefined ? user : user[field];
  },
);
