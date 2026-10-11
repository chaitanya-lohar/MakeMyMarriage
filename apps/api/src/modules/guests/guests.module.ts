import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/index.js';
import { EventsModule } from '../events/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { GuestEventsController } from './api/controllers/guest-events.controller.js';
import { GuestsController } from './api/controllers/guests.controller.js';
import { GuestsService } from './application/services/guests.service.js';
import { GuestAssignmentsUseCase } from './application/use-cases/guest-assignments.use-case.js';
import { ListGuestsUseCase } from './application/use-cases/list-guests.use-case.js';
import { SaveGuestUseCase } from './application/use-cases/save-guest.use-case.js';
import { UpdateRsvpUseCase } from './application/use-cases/update-rsvp.use-case.js';
import { GuestEventsRepository } from './infrastructure/repositories/guest-events.repository.js';
import { GuestsRepository } from './infrastructure/repositories/guests.repository.js';
import { GuestRecord, GuestSchema } from './infrastructure/schemas/guest.schema.js';
import { GuestEventRecord, GuestEventSchema } from './infrastructure/schemas/guest-event.schema.js';

/**
 * Guest records, event assignments and their RSVPs (System Design §6: Guests and RSVP;
 * Database Design §10.1–10.2, decision 0017).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GuestRecord.name, schema: GuestSchema },
      { name: GuestEventRecord.name, schema: GuestEventSchema },
    ]),
    WorkspaceModule,
    EventsModule,
    AuditModule,
  ],
  controllers: [GuestsController, GuestEventsController],
  providers: [
    GuestsRepository,
    GuestEventsRepository,
    GuestsService,
    SaveGuestUseCase,
    ListGuestsUseCase,
    GuestAssignmentsUseCase,
    UpdateRsvpUseCase,
  ],
})
export class GuestsModule {}
