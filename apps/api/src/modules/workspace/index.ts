// Public entry point of the workspace module (decision 0006).
export { MembershipsService } from './application/services/memberships.service.js';
export { PermissionService } from './application/services/permission.service.js';
export { WeddingAccessGuard, weddingNotFound } from './api/wedding-access.guard.js';
export { PermissionGuard, permissionDenied } from './api/permission.guard.js';
export {
  CurrentMembership,
  CurrentPermissions,
  MembershipOnly,
  RequirePermission,
} from './api/permission.decorators.js';
export { MemberType, MembershipRole, MembershipStatus } from './domain/enums/membership.js';
export { PermissionAction, PermissionEffect, PermissionModule } from './domain/enums/permission.js';
export { EffectivePermissions, evaluatePermissions } from './domain/rules/evaluate-permissions.js';
export {
  DEFAULT_ROLE_MATRIX,
  defaultActions,
  isManagementAction,
  isModuleAction,
  isProtectedModule,
  MODULE_ACTIONS,
  OWNER_ONLY_BY_DEFAULT,
  ProtectedOperation,
} from './domain/rules/permission-catalogue.js';
export {
  OWNER_SEATS,
  OwnerMembershipExistsError,
  OwnerSeatTakenError,
  type InvitedAccess,
  type Membership,
  type OwnerSeat,
  type PartnerAdmission,
  type PermissionOverride,
} from './domain/types/membership.js';
export { WorkspaceModule } from './workspace.module.js';
