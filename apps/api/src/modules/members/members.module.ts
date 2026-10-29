import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import {
  MemberInvitationResponseController,
  MemberInvitationsController,
} from './api/controllers/member-invitations.controller.js';
import { MembersController } from './api/controllers/members.controller.js';
import { OwnershipTransfersController } from './api/controllers/ownership-transfers.controller.js';
import { MemberInvitationsService } from './application/services/member-invitations.service.js';
import { MembersService } from './application/services/members.service.js';
import { OwnershipTransfersService } from './application/services/ownership-transfers.service.js';
import { MemberInvitationsRepository } from './infrastructure/repositories/member-invitations.repository.js';
import { OwnershipTransfersRepository } from './infrastructure/repositories/ownership-transfers.repository.js';
import {
  MemberInvitationRecord,
  MemberInvitationSchema,
} from './infrastructure/schemas/member-invitation.schema.js';
import {
  OwnershipTransferRecord,
  OwnershipTransferSchema,
} from './infrastructure/schemas/ownership-transfer.schema.js';

/**
 * Organizer and permission management (System Design §6, §7; decision 0034): the member
 * directory, roles and custom permissions, removal, organizer invitations, ownership-seat
 * transfer and the audit history.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemberInvitationRecord.name, schema: MemberInvitationSchema },
      { name: OwnershipTransferRecord.name, schema: OwnershipTransferSchema },
    ]),
    WorkspaceModule,
    UsersModule,
    WeddingsModule,
  ],
  controllers: [
    MembersController,
    MemberInvitationsController,
    MemberInvitationResponseController,
    OwnershipTransfersController,
  ],
  providers: [
    MembersService,
    MemberInvitationsService,
    OwnershipTransfersService,
    MemberInvitationsRepository,
    OwnershipTransfersRepository,
  ],
  exports: [MembersService],
})
export class MembersModule {}
