import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Identity attached to a request by the auth guard (modules/auth). */
export interface RequestAuth {
  userId: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: RequestAuth;
}

export const IS_PUBLIC = Symbol('isPublic');

/**
 * Opts a controller or handler out of the global sign-in requirement (decision 0015).
 * Use only for endpoints that must work without a session.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Injects the signed-in user's identity into a handler parameter. */
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.auth) {
    // Only reachable if a public handler asks for the identity — a programming error.
    throw new Error('CurrentAuth used on a route without an authenticated request');
  }
  return request.auth;
});
