import { fail, isApiEnvelope, ok, type ApiEnvelope } from "@hasut/types";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable, map } from "rxjs";
import { getRequestId } from "../middleware/request-id.middleware";

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = getRequestId(request);

    return next.handle().pipe(
      map((data: unknown) => {
        if (isApiEnvelope(data)) {
          return data;
        }
        if (data === undefined || data === null) {
          return fail("INTERNAL_ERROR", "Empty response", requestId);
        }
        return ok(data, requestId);
      }),
    );
  }
}
