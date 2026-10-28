import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../common/auth/request-auth.js';
import { AppException } from '../../../common/errors/app.exception.js';
import { MembershipsService } from '../application/services/memberships.service.js';
import { PermissionService } from '../application/services/permission.service.js';
import type { EffectivePermissions } from '../domain/rules/evaluate-permissions.js';
import type { Membership } from '../domain/types/membership.js';

export interface WeddingRequest extends AuthenticatedRequest {
  membership?: Membership;
  /** The membership's effective permissions (Database Design §8.4). */
  permissions?: EffectivePermissions;
}

/** The wedding does not exist, or the user is not an active member — never told apart. */
export const weddingNotFound = () =>
  new AppException({
    code: 'WEDDING_NOT_FOUND',
    message: 'The requested wedding was not found.',
    status: HttpStatus.NOT_FOUND,
  });

/**
 * Admits a request to a `:weddingId` route only when the signed-in user has an ACTIVE
 * membership of that wedding (System Design §7.3). Anything else is a 404, so the API never
 * reveals whether a wedding exists (decision 0016). It puts the membership and its effective
 * permissions on the request for PermissionGuard and the handlers. Runs after the global
 * sign-in guard, and only once per request even when declared twice.
 */
@Injectable()
export class WeddingAccessGuard implements CanActivate {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WeddingRequest>();
    const weddingId = request.params.weddingId;
    if (request.membership && request.membership.weddingId === weddingId) return true;

    const membership =
      request.auth && typeof weddingId === 'string'
        ? await this.memberships.findActive(request.auth.userId, weddingId)
        : null;
    if (!membership) throw weddingNotFound();

    request.membership = membership;
    request.permissions = this.permissions.evaluate(membership);
    return true;
  }
}
