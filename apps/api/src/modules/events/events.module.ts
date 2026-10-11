import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { EventsController } from './api/controllers/events.controller.js';
import { EventsService } from './application/services/events.service.js';
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js';
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case.js';
import { EventsRepository } from './infrastructure/repositories/events.repository.js';
import { EventRecord, EventSchema } from './infrastructure/schemas/event.schema.js';

/** Predefined and custom wedding events (System Design §6, decision 0017). */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: EventRecord.name, schema: EventSchema }]),
    WorkspaceModule,
    WeddingsModule,
  ],
  controllers: [EventsController],
  providers: [EventsRepository, EventsService, CreateEventUseCase, UpdateEventUseCase],
  exports: [EventsService],
})
export class EventsModule {}
