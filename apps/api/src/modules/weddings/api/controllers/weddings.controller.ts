import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import {
  MembershipOnly,
  PermissionAction,
  PermissionModule,
  RequirePermission,
  WeddingAccessGuard,
} from '../../../workspace/index.js';
import { CreateWeddingUseCase } from '../../application/use-cases/create-wedding.use-case.js';
import { GetWeddingUseCase } from '../../application/use-cases/get-wedding.use-case.js';
import { ListWeddingsUseCase } from '../../application/use-cases/list-weddings.use-case.js';
import { UpdateWeddingUseCase } from '../../application/use-cases/update-wedding.use-case.js';
import { CreateWeddingDto, UpdateWeddingDto, WeddingDto } from '../dto/wedding.dto.js';

/** Wedding setup (API Design §6, decision 0016). */
@ApiTags('Weddings')
@ApiCookieAuth('session')
@Controller('weddings')
export class WeddingsController {
  constructor(
    private readonly createWedding: CreateWeddingUseCase,
    private readonly listWeddings: ListWeddingsUseCase,
    private readonly getWedding: GetWeddingUseCase,
    private readonly updateWedding: UpdateWeddingUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create the user's wedding; the user becomes its owner" })
  @ApiEnvelopeResponse(201, WeddingDto)
  @ApiErrorResponses(
    { status: 400, description: 'Invalid details' },
    { status: 401, description: 'Not signed in' },
    { status: 409, description: 'WEDDING_ALREADY_OWNED — the user already owns a wedding' },
  )
  async create(
    @CurrentAuth() auth: RequestAuth,
    @Body() body: CreateWeddingDto,
  ): Promise<WeddingDto> {
    const wedding = await this.createWedding.execute(auth.userId, {
      brideName: body.brideName,
      groomName: body.groomName,
      startDate: body.startDate ?? null,
      venueName: body.venueName ?? null,
      primaryCity: body.primaryCity ?? null,
      description: body.description ?? null,
    });
    return WeddingDto.from(wedding);
  }

  @Get()
  @ApiOperation({ summary: 'Weddings the user is an active member of' })
  @ApiEnvelopeResponse(200, [WeddingDto])
  @ApiErrorResponses({ status: 401, description: 'Not signed in' })
  async list(@CurrentAuth() auth: RequestAuth): Promise<WeddingDto[]> {
    const weddings = await this.listWeddings.execute(auth.userId);
    return weddings.map((wedding) => WeddingDto.from(wedding));
  }

  @Get(':weddingId')
  @MembershipOnly()
  @UseGuards(WeddingAccessGuard)
  @ApiOperation({ summary: 'Get a wedding' })
  @ApiEnvelopeResponse(200, WeddingDto)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND — missing, or not a member' },
  )
  async get(@Param('weddingId') weddingId: string): Promise<WeddingDto> {
    return WeddingDto.from(await this.getWedding.execute(weddingId));
  }

  @Patch(':weddingId')
  @RequirePermission(PermissionModule.WeddingSettings, PermissionAction.Edit)
  @UseGuards(WeddingAccessGuard)
  @ApiOperation({ summary: "Update a wedding's details" })
  @ApiEnvelopeResponse(200, WeddingDto)
  @ApiErrorResponses(
    { status: 400, description: 'Invalid details' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND — missing, or not a member' },
  )
  async update(
    @Param('weddingId') weddingId: string,
    @Body() body: UpdateWeddingDto,
  ): Promise<WeddingDto> {
    return WeddingDto.from(await this.updateWedding.execute(weddingId, body));
  }
}
