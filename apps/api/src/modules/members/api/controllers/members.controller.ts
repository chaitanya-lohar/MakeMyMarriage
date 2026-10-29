import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ValidationFailedException } from '../../../../common/errors/validation-failed.exception.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../../../common/http/api-envelope.decorator.js';
import { Paginated } from '../../../../common/http/paginated.js';
import {
  CurrentMembership,
  CurrentPermissions,
  MembershipOnly,
  PermissionAction,
  PermissionModule,
  RequirePermission,
  WeddingAccessGuard,
  type EffectivePermissions,
  type Membership,
} from '../../../workspace/index.js';
import { MembersService } from '../../application/services/members.service.js';
import {
  AuditLogDto,
  AuditLogQueryDto,
  ListMembersQueryDto,
  MemberDto,
  MemberPermissionsDto,
  UpdateMemberDto,
} from '../dto/member.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND, or MEMBER_NOT_FOUND — missing, removed or another wedding',
};
const denied = {
  status: 403,
  description: 'PERMISSION_DENIED, with details.reason for a protected membership (P10-4)',
};

/** Members of a wedding and their permissions (API Design §7.1, decision 0034). */
@ApiTags('Members')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('members')
  @MembershipOnly()
  @ApiOperation({
    summary: 'Members, owners first; directory fields for all, details with MEMBERS:VIEW',
  })
  @ApiPaginatedResponse(MemberDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid query or cursor' },
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED — removed members need MEMBERS:VIEW' },
    notFound,
  )
  async list(
    @Param('weddingId') weddingId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
    @Query() query: ListMembersQueryDto,
  ): Promise<Paginated<MemberDto>> {
    const page = await this.members.list(weddingId, { membership, permissions }, query);
    const details = permissions.has(PermissionModule.Members, PermissionAction.View);
    return new Paginated(
      page.members.map((member) => MemberDto.from(member, details)),
      page.nextCursor,
    );
  }

  @Get('members/me/permissions')
  @MembershipOnly()
  @ApiOperation({ summary: "The caller's effective permissions in this wedding" })
  @ApiParam({ name: 'weddingId', type: String })
  @ApiEnvelopeResponse(200, MemberPermissionsDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  me(
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): MemberPermissionsDto {
    return MemberPermissionsDto.from(membership, permissions);
  }

  @Get('members/:membershipId/permissions')
  @RequirePermission(PermissionModule.Members, PermissionAction.View)
  @ApiOperation({ summary: "A member's effective permissions" })
  @ApiEnvelopeResponse(200, MemberPermissionsDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, denied, notFound)
  async permissions(
    @Param('weddingId') weddingId: string,
    @Param('membershipId') membershipId: string,
  ): Promise<MemberPermissionsDto> {
    const { membership } = await this.members.activeMember(weddingId, membershipId);
    return MemberPermissionsDto.from(
      membership,
      await this.members.permissionsOf(weddingId, membershipId),
    );
  }

  /**
   * Declares MEMBERS:VIEW, which both management actions need; the service then requires
   * CHANGE_ROLE for a role and EDIT_PERMISSIONS for overrides (API Design §7.1).
   */
  @Patch('members/:membershipId')
  @RequirePermission(PermissionModule.Members, PermissionAction.View)
  @ApiOperation({ summary: "Change a member's role and/or custom permissions" })
  @ApiEnvelopeResponse(200, MemberDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    denied,
    notFound,
  )
  async update(
    @Param('weddingId') weddingId: string,
    @Param('membershipId') membershipId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
    @Body() body: UpdateMemberDto,
  ): Promise<MemberDto> {
    if (body.role === undefined && body.permissionOverrides === undefined) {
      throw new ValidationFailedException({
        role: ['Change the role, the custom permissions or both.'],
      });
    }
    const member = await this.members.update(weddingId, { membership, permissions }, membershipId, {
      ...(body.role !== undefined && { role: body.role }),
      ...(body.permissionOverrides !== undefined && {
        permissionOverrides: body.permissionOverrides,
      }),
    });
    return MemberDto.from(member, true);
  }

  @Delete('members/:membershipId')
  @RequirePermission(PermissionModule.Members, PermissionAction.Remove)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member; their records stay' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, denied, notFound)
  async remove(
    @Param('weddingId') weddingId: string,
    @Param('membershipId') membershipId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): Promise<void> {
    await this.members.remove(weddingId, { membership, permissions }, membershipId);
  }

  @Get('audit-logs')
  @RequirePermission(PermissionModule.Audit, PermissionAction.View)
  @ApiOperation({ summary: "The wedding's audit history, newest first" })
  @ApiPaginatedResponse(AuditLogDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid query or cursor' },
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED' },
    notFound,
  )
  async auditLogs(
    @Param('weddingId') weddingId: string,
    @Query() query: AuditLogQueryDto,
  ): Promise<Paginated<AuditLogDto>> {
    const page = await this.members.auditHistory(weddingId, query);
    return new Paginated(
      page.records.map((record) => AuditLogDto.from(record)),
      page.nextCursor,
    );
  }
}
