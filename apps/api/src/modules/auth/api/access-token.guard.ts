import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, type AuthenticatedRequest } from '../../../common/auth/request-auth.js';
import { AuthErrors } from '../application/auth-errors.js';
import { TokenService } from '../application/services/token.service.js';
import { ACCESS_COOKIE } from './session-cookies.js';

/**
 * Global guard: every route requires a valid access token unless marked @Public()
 * (decision 0015). Tokens are verified without a database lookup.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = (request.cookies as Record<string, string | undefined> | undefined)?.[
      ACCESS_COOKIE
    ];
    const claims = token ? await this.tokens.verifyAccessToken(token) : null;
    if (!claims) throw AuthErrors.unauthenticated();

    request.auth = { userId: claims.userId, sessionId: claims.sessionId };
    return true;
  }
}
