import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UseGuards,
  type ExecutionContext,
} from '@nestjs/common';
import type { PermissionAction, PermissionModule } from '../domain/enums/permission.js';
import type { EffectivePermissions } from '../domain/rules/evaluate-permissions.js';
import type { Membership } from '../domain/types/membership.js';
import { PermissionGuard } from './permission.guard.js';
import {
  MEMBERSHIP_ONLY,
  REQUIRED_PERMISSION,
  type RequiredPermission,
} from './permission.metadata.js';
import { WeddingAccessGuard, type WeddingRequest } from './wedding-access.guard.js';

/**
 * Declares the one `(module, action)` a wedding route needs (API Design §23). An active
 * member without it gets `403 PERMISSION_DENIED`; a non-member still gets `404`. It brings
 * its own guards, so it works whether WeddingAccessGuard is declared on the controller, on
 * the handler (in either decorator order) or not at all; the access guard runs only once.
 */
export const RequirePermission = (
  module: PermissionModule,
  action: PermissionAction,
): MethodDecorator =>
  applyDecorators(
    SetMetadata(REQUIRED_PERMISSION, { module, action } satisfies RequiredPermission),
    UseGuards(WeddingAccessGuard, PermissionGuard),
  );

/**
 * Marks one of the few wedding routes that need only an active membership (API Design §23:
 * `GET /weddings`, `GET /weddings/{id}`, `GET …/dashboard`, `GET …/members`,
 * `GET …/members/me/permissions`; and the ownership-transfer routes, whose owner and
 * recipient checks are in the service, §7.1). The route-permission contract test refuses it
 * elsewhere.
 */
export const MembershipOnly = (): MethodDecorator => SetMetadata(MEMBERSHIP_ONLY, true);

function weddingRequest(context: ExecutionContext): WeddingRequest {
  return context.switchToHttp().getRequest<WeddingRequest>();
}

/** Injects the caller's ACTIVE membership of the route's wedding. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Membership => {
    const { membership } = weddingRequest(context);
    // Only reachable on a route without WeddingAccessGuard — a programming error.
    if (!membership)
      throw new Error('CurrentMembership used on a route without WeddingAccessGuard');
    return membership;
  },
);

/** Injects the caller's effective permissions in the route's wedding. */
export const CurrentPermissions = createParamDecorator(
  (_data: unknown, context: ExecutionContext): EffectivePermissions => {
    const { permissions } = weddingRequest(context);
    if (!permissions) {
      throw new Error('CurrentPermissions used on a route without WeddingAccessGuard');
    }
    return permissions;
  },
);
