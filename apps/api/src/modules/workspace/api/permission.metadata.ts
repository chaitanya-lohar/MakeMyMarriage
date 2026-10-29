import type { PermissionAction, PermissionModule } from '../domain/enums/permission.js';

/** The `(module, action)` a wedding route declares with `@RequirePermission` (API Design §23). */
export interface RequiredPermission {
  module: PermissionModule;
  action: PermissionAction;
}

export const REQUIRED_PERMISSION = Symbol('requiredPermission');
export const MEMBERSHIP_ONLY = Symbol('membershipOnly');
