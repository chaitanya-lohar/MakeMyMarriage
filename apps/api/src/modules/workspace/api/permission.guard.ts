import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../../common/errors/app.exception.js';
import { AuditAction, AuditService } from '../../audit/index.js';
import { isManagementAction } from '../domain/rules/permission-catalogue.js';
import { REQUIRED_PERMISSION, type RequiredPermission } from './permission.metadata.js';
import type { WeddingRequest } from './wedding-access.guard.js';

/**
 * An active member lacking a permission (API Design §7.1, §21). They already know the
 * wedding exists, so this is a 403, not the 404 of non-members. Services refusing a
 * business rule pass the `details.reason` of API Design §7.1.
 */
export const permissionDenied = (reason?: string) =>
  new AppException({
    code: 'PERMISSION_DENIED',
    message: 'You do not have permission to perform this action.',
    status: HttpStatus.FORBIDDEN,
    ...(reason && { details: { reason } }),
  });

/** The matched route pattern, e.g. `/weddings/:weddingId/expenses`; the path only if none. */
function routePath(request: WeddingRequest): string {
  const route = (request as { route?: { path?: unknown } }).route;
  return typeof route?.path === 'string' ? route.path : request.path;
}

/**
 * Refuses a request whose route declares `@RequirePermission(module, action)` when the
 * caller's effective permissions lack it (System Design §7.3, §7.7). Runs after
 * WeddingAccessGuard, which resolves the membership and its permissions. A refused
 * management action — sending a guest link, for one — is audited (Database Design §22).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<WeddingRequest>();
    const { permissions, membership } = request;
    if (!permissions || !membership) {
      // WeddingAccessGuard did not run first — a programming error, never a client error.
      throw new Error('PermissionGuard ran before WeddingAccessGuard');
    }
    if (permissions.has(required.module, required.action)) return true;

    if (isManagementAction(required.action)) {
      await this.audit.record({
        weddingId: membership.weddingId,
        actorUserId: membership.userId,
        action: AuditAction.PermissionDenied,
        resourceType: 'wedding_membership',
        resourceId: membership.id,
        metadata: {
          module: required.module,
          action: required.action,
          route: `${request.method} ${routePath(request)}`,
          outcome: 'DENIED',
        },
      });
    }
    throw permissionDenied();
  }
}
