import { REQUEST_ID_HEADER } from "@hasut/types";
import { normalizeRequestId } from "@hasut/utils";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_PROPERTY = "requestId";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header(REQUEST_ID_HEADER);
  const requestId = normalizeRequestId(header);
  Object.assign(req, { [REQUEST_ID_PROPERTY]: requestId });
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function getRequestId(req: Request): string {
  const value = (req as Request & { requestId?: string }).requestId;
  return value ?? normalizeRequestId(req.header(REQUEST_ID_HEADER));
}
