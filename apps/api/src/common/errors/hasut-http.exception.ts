import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrorCode } from "@hasut/types";

export class HasutHttpException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}
