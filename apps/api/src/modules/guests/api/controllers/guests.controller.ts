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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../../../common/http/api-envelope.decorator.js';
import { Paginated } from '../../../../common/http/paginated.js';
import { WeddingAccessGuard } from '../../../workspace/index.js';
import { GuestInvitations } from '../../application/ports/guest-invitations.port.js';
import { GuestsService } from '../../application/services/guests.service.js';
import { GuestAssignmentsUseCase } from '../../application/use-cases/guest-assignments.use-case.js';
import { ListGuestsUseCase } from '../../application/use-cases/list-guests.use-case.js';
import { SaveGuestUseCase } from '../../application/use-cases/save-guest.use-case.js';
import { AssignGuestDto, GuestEventDto } from '../dto/guest-event.dto.js';
import type { Guest, GuestSaveResult } from '../../domain/types/guest.js';
import {
  CreateGuestDto,
  GuestDto,
  GuestInvitationSummaryDto,
  GuestSaveResultDto,
  ListGuestsQueryDto,
  normalizedMobile,
  UpdateGuestDto,
} from '../dto/guest.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND or GUEST_NOT_FOUND — missing, deleted or not a member',
};

/** Guests and their event assignments (API Design §9, decision 0017). */
@ApiTags('Guests')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/guests')
export class GuestsController {
  constructor(
    private readonly guests: GuestsService,
    private readonly saveGuest: SaveGuestUseCase,
    private readonly listGuests: ListGuestsUseCase,
    private readonly assignments: GuestAssignmentsUseCase,
    private readonly invitations: GuestInvitations,
  ) {}

  /** Guests with their invitation state, so organizers need no extra request (API §9). */
  private async withInvitations(weddingId: string, guests: Guest[]): Promise<GuestDto[]> {
    const summaries = await this.invitations.summariesFor(
      weddingId,
      guests.map((guest) => guest.id),
    );
    return guests.map((guest) => {
      const summary = summaries.get(guest.id);
      return GuestDto.from(guest, summary ? GuestInvitationSummaryDto.from(summary) : null);
    });
  }

  private async saveResult(weddingId: string, result: GuestSaveResult) {
    const [guest] = await this.withInvitations(weddingId, [result.guest]);
    return GuestSaveResultDto.from(result, guest as GuestDto);
  }

  @Get()
  @ApiOperation({ summary: 'List, search and filter guests, alphabetically' })
  @ApiPaginatedResponse(GuestDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid query or cursor' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, or EVENT_NOT_FOUND for the event filter' },
  )
  async list(
    @Param('weddingId') weddingId: string,
    @Query() query: ListGuestsQueryDto,
  ): Promise<Paginated<GuestDto>> {
    const page = await this.listGuests.execute(weddingId, {
      search: query.search ?? undefined,
      eventId: query.eventId,
      rsvpStatus: query.rsvpStatus,
      limit: query.limit,
      cursor: query.cursor,
    });
    return new Paginated(await this.withInvitations(weddingId, page.guests), page.nextCursor);
  }

  @Post()
  @ApiOperation({ summary: 'Create a guest; warns about other guests with the same mobile' })
  @ApiEnvelopeResponse(201, GuestSaveResultDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    notFound,
  )
  async create(
    @Param('weddingId') weddingId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: CreateGuestDto,
  ): Promise<GuestSaveResultDto> {
    const dto = normalizedMobile(body);
    const result = await this.saveGuest.create(weddingId, auth.userId, {
      name: dto.name,
      mobile: dto.mobile,
      email: dto.email ?? null,
      relation: dto.relation ?? null,
      notes: dto.notes ?? null,
    });
    return this.saveResult(weddingId, result);
  }

  @Get(':guestId')
  @ApiOperation({ summary: 'Get a guest' })
  @ApiEnvelopeResponse(200, GuestDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async get(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
  ): Promise<GuestDto> {
    const [guest] = await this.withInvitations(weddingId, [
      await this.guests.getActive(weddingId, guestId),
    ]);
    return guest as GuestDto;
  }

  @Patch(':guestId')
  @ApiOperation({ summary: 'Update a guest; null clears an optional field' })
  @ApiEnvelopeResponse(200, GuestSaveResultDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    notFound,
  )
  async update(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @Body() body: UpdateGuestDto,
  ): Promise<GuestSaveResultDto> {
    return this.saveResult(
      weddingId,
      await this.saveGuest.update(weddingId, guestId, normalizedMobile(body)),
    );
  }

  @Delete(':guestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a guest; their RSVP and invitation history is kept' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async delete(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<void> {
    await this.guests.delete(weddingId, guestId, auth.userId);
  }

  @Get(':guestId/events')
  @ApiOperation({ summary: "The guest's active assignments, in event order" })
  @ApiEnvelopeResponse(200, [GuestEventDto])
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async listAssignments(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
  ): Promise<GuestEventDto[]> {
    const assignments = await this.assignments.list(weddingId, guestId);
    return assignments.map((assignment) => GuestEventDto.from(assignment));
  }

  @Post(':guestId/events')
  @ApiOperation({
    summary: 'Assign the guest to an event (201), or return the existing assignment (200)',
  })
  @ApiEnvelopeResponse(201, GuestEventDto, 'Assignment created with RSVP PENDING')
  @ApiEnvelopeResponse(200, GuestEventDto, 'The guest was already assigned; returned unchanged')
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, GUEST_NOT_FOUND or EVENT_NOT_FOUND' },
  )
  async assign(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @Body() body: AssignGuestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GuestEventDto> {
    const { assignment, created } = await this.assignments.assign(weddingId, guestId, body.eventId);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return GuestEventDto.from(assignment);
  }
}
