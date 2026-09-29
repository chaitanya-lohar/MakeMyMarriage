import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import { requestIdOf } from './request-id.js';
import { SKIP_ENVELOPE } from './skip-envelope.decorator.js';

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

/**
 * Wraps successful responses in the standard envelope (API Design §20).
 * List/pagination metadata is added when the first paginated endpoint is built.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_ENVELOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      map((data: unknown): SuccessEnvelope<unknown> => ({
        data: data ?? null,
        meta: { requestId: requestIdOf(request), timestamp: new Date().toISOString() },
      })),
    );
  }
}
