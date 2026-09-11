import { fail, type ApiFailure, type ErrorCode } from "@hasut/types";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ZodError } from "zod";
import type { Request, Response } from "express";
import { captureException } from "../../observability/sentry";
import { getRequestId } from "../middleware/request-id.middleware";
import { HasutHttpException } from "../errors/hasut-http.exception";

interface ExceptionShape {
  errorCode?: ErrorCode;
  message?: string | string[];
  details?: Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = getRequestId(request);

    const { status, body } = this.toEnvelope(exception, requestId);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          requestId,
          status,
          err: exception instanceof Error ? exception.message : "unknown",
        },
        "Unhandled exception",
      );
      captureException(exception, requestId);
    }

    response.status(status).json(body);
  }

  private toEnvelope(exception: unknown, requestId: string): { status: number; body: ApiFailure } {
    if (exception instanceof HasutHttpException) {
      return {
        status: exception.getStatus(),
        body: fail(exception.errorCode, exception.message, requestId, exception.details),
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: fail("VALIDATION_ERROR", "Request validation failed", requestId, {
          issues: exception.issues,
        }),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const shape = this.readShape(payload);
      const code = shape.errorCode ?? this.codeFromStatus(status);
      const message = this.clientMessage(shape.message, status);
      return {
        status,
        body: fail(code, message, requestId, shape.details),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: fail("INTERNAL_ERROR", "An unexpected error occurred", requestId),
    };
  }

  private readShape(payload: string | object): ExceptionShape {
    if (typeof payload === "string") {
      return { message: payload };
    }
    return payload as ExceptionShape;
  }

  private clientMessage(message: string | string[] | undefined, status: number): string {
    if (typeof message === "string" && message.length > 0 && status < 500) {
      return message;
    }
    if (Array.isArray(message) && message.length > 0 && status < 500) {
      const first = message[0];
      return first ?? "Request failed";
    }
    if (status >= 500) {
      return "An unexpected error occurred";
    }
    return "Request failed";
  }

  private codeFromStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "VALIDATION_ERROR";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHENTICATED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "RATE_LIMITED";
      case HttpStatus.SERVICE_UNAVAILABLE:
        return "SERVICE_UNAVAILABLE";
      default:
        return status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR";
    }
  }
}
