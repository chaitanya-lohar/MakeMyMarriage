import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import { WeddingAccessGuard } from '../../../workspace/index.js';
import { EventsService } from '../../application/services/events.service.js';
import { CreateEventUseCase } from '../../application/use-cases/create-event.use-case.js';
import { UpdateEventUseCase } from '../../application/use-cases/update-event.use-case.js';
import type { EventChanges } from '../../domain/types/event.js';
import { CreateEventDto, EventDto, UpdateEventDto } from '../dto/event.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND or EVENT_NOT_FOUND — missing, deleted or not a member',
};

/** Wedding events (API Design §8, decision 0017). */
@ApiTags('Events')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly createEvent: CreateEventUseCase,
    private readonly updateEvent: UpdateEventUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active events, by date then start time (untimed first)' })
  @ApiEnvelopeResponse(200, [EventDto])
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async list(@Param('weddingId') weddingId: string): Promise<EventDto[]> {
    const events = await this.events.listActive(weddingId);
    return events.map((event) => EventDto.from(event));
  }

  @Post()
  @ApiOperation({ summary: 'Create an event' })
  @ApiEnvelopeResponse(201, EventDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    notFound,
  )
  async create(
    @Param('weddingId') weddingId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: CreateEventDto,
  ): Promise<EventDto> {
    const event = await this.createEvent.execute(weddingId, auth.userId, {
      name: body.name,
      type: body.type,
      date: body.date,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      description: body.description ?? null,
      venue: { name: body.venue?.name ?? null, address: body.venue?.address ?? null },
      dressCode: body.dressCode ?? null,
      notes: body.notes ?? null,
    });
    return EventDto.from(event);
  }

  @Get(':eventId')
  @ApiOperation({ summary: 'Get an event' })
  @ApiEnvelopeResponse(200, EventDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async get(
    @Param('weddingId') weddingId: string,
    @Param('eventId') eventId: string,
  ): Promise<EventDto> {
    return EventDto.from(await this.events.getActive(weddingId, eventId));
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Update an event; null clears an optional field' })
  @ApiEnvelopeResponse(200, EventDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    notFound,
  )
  async update(
    @Param('weddingId') weddingId: string,
    @Param('eventId') eventId: string,
    @Body() body: UpdateEventDto,
  ): Promise<EventDto> {
    const { venue, ...fields } = body;
    const changes: EventChanges = { ...fields };
    // `venue: null` clears both venue fields; an object changes only the fields it carries.
    if (venue === null) changes.venue = { name: null, address: null };
    else if (venue !== undefined) changes.venue = { ...venue };
    return EventDto.from(await this.updateEvent.execute(weddingId, eventId, changes));
  }

  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an event; its RSVP and invitation history is kept' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async delete(
    @Param('weddingId') weddingId: string,
    @Param('eventId') eventId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<void> {
    await this.events.delete(weddingId, eventId, auth.userId);
  }
}
