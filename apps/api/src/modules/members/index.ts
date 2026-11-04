// Public entry point of the members module (decision 0006).
export { MembersModule } from './members.module.js';
export { MembersService } from './application/services/members.service.js';
export { OwnershipTransfersService } from './application/services/ownership-transfers.service.js';
// Shared with partner invitations (decision 0038 D4: the same token and expiry rules).
export {
  emailHint,
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
  isWellFormedToken,
  newInvitationToken,
} from './domain/rules/invitation-rules.js';
