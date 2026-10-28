import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../../common/errors/app.exception.js';
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

/**
 * Refuses a request whose route declares `@RequirePermission(module, action)` when the
 * caller's effective permissions lack it (System Design §7.3, §7.7). Runs after
 * WeddingAccessGuard, which resolves the membership and its permissions.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const { permissions } = context.switchToHttp().getRequest<WeddingRequest>();
    if (!permissions) {
      // WeddingAccessGuard did not run first — a programming error, never a client error.
      throw new Error('PermissionGuard ran before WeddingAccessGuard');
    }
    if (!permissions.has(required.module, required.action)) throw permissionDenied();
    return true;
  }
}
