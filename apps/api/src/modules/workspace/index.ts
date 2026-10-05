// Public entry point of the workspace module (decision 0006).
export { MembershipsService } from './application/services/memberships.service.js';
export { WeddingAccessGuard, weddingNotFound } from './api/wedding-access.guard.js';
export { MemberType, MembershipRole, MembershipStatus } from './domain/enums/membership.js';
export { OwnerMembershipExistsError, type Membership } from './domain/types/membership.js';
export { WorkspaceModule } from './workspace.module.js';
