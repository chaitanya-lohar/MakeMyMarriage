import { Module } from '@nestjs/common';
import { EmailWorkerModule } from '../../infrastructure/email/email-worker.module.js';
import { GuestsModule } from '../guests/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { InvitationEmailProcessor } from './application/services/invitation-email.processor.js';
import { InvitationsModule } from './invitations.module.js';

/** Consumer side of invitation email; imported only by the worker runtime. */
@Module({
  imports: [InvitationsModule, GuestsModule, WeddingsModule, EmailWorkerModule],
  providers: [InvitationEmailProcessor],
})
export class InvitationsWorkerModule {}
