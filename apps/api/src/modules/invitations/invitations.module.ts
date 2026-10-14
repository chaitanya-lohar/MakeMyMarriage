import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/index.js';
import { GuestInvitations, GuestsModule } from '../guests/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { GuestInvitationController } from './api/controllers/guest-invitation.controller.js';
import { InvitationsController } from './api/controllers/invitations.controller.js';
import { GuestInvitationsAdapter } from './application/services/guest-invitations.adapter.js';
import { InvitationEmailService } from './application/services/invitation-email.service.js';
import { InvitationTokensService } from './application/services/invitation-tokens.service.js';
import { GuestInvitationAccessUseCase } from './application/use-cases/guest-invitation-access.use-case.js';
import { ManageInvitationUseCase } from './application/use-cases/manage-invitation.use-case.js';
import { GuestInvitationsRepository } from './infrastructure/repositories/guest-invitations.repository.js';
import { InvitationHistoryRepository } from './infrastructure/repositories/invitation-history.repository.js';
import {
  GuestInvitationRecord,
  GuestInvitationSchema,
} from './infrastructure/schemas/guest-invitation.schema.js';
import {
  InvitationActivityRecord,
  InvitationActivitySchema,
} from './infrastructure/schemas/invitation-activity.schema.js';
import {
  InvitationDeliveryRecord,
  InvitationDeliverySchema,
} from './infrastructure/schemas/invitation-delivery.schema.js';

/**
 * Invitation tokens, delivery lifecycle and activity (System Design §6, Database Design
 * §10.3–10.5, decisions 0008 and 0017–0020).
 *
 * Global only so the guests module can use the GuestInvitations port without importing this
 * module, which depends on guests (see the port).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GuestInvitationRecord.name, schema: GuestInvitationSchema },
      { name: InvitationDeliveryRecord.name, schema: InvitationDeliverySchema },
      { name: InvitationActivityRecord.name, schema: InvitationActivitySchema },
    ]),
    WorkspaceModule,
    WeddingsModule,
    GuestsModule,
    AuditModule,
  ],
  controllers: [InvitationsController, GuestInvitationController],
  providers: [
    GuestInvitationsRepository,
    InvitationHistoryRepository,
    InvitationTokensService,
    InvitationEmailService,
    ManageInvitationUseCase,
    GuestInvitationAccessUseCase,
    { provide: GuestInvitations, useClass: GuestInvitationsAdapter },
  ],
  exports: [GuestInvitations],
})
export class InvitationsModule {}
