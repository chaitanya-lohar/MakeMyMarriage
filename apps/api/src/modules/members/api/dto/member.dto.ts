import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuditAction, type AuditRecord } from '../../../audit/index.js';
import { Matches } from '../../../../common/http/dto-validators.js';
import { isCalendarDate } from '../../../weddings/index.js';
import {
  MemberType,
  MembershipStatus,
  MODULE_ACTIONS,
  PermissionEffect,
  type EffectivePermissions,
  type Membership,
  type PermissionAction,
  type PermissionModule,
} from '../../../workspace/index.js';
import {
  ASSIGNABLE_ROLES,
  MAX_OVERRIDES,
  type AssignableRole,
} from '../../domain/rules/member-authority.js';
import type { MemberView } from '../../domain/types/member.js';

const MODULES = Object.keys(MODULE_ACTIONS);
const ACTIONS = [...new Set(Object.values(MODULE_ACTIONS).flat())];
const LISTED_STATUSES = [MembershipStatus.Active, MembershipStatus.Revoked] as const;
const MAX_PAGE = 100;

/** One `ALLOW` or `DENY` of a `(module, action)` (Database Design §8.4). */
export class PermissionOverrideDto {
  @ApiProperty({ enum: MODULES })
  @IsIn(MODULES, { message: 'Choose a known module.' })
  module!: PermissionModule;

  @ApiProperty({ enum: ACTIONS })
  @IsIn(ACTIONS, { message: 'Choose a known action.' })
  action!: PermissionAction;

  @ApiProperty({ enum: Object.values(PermissionEffect) })
  @IsIn(Object.values(PermissionEffect), { message: 'Choose ALLOW or DENY.' })
  effect!: PermissionEffect;
}

/**
 * A wedding member (API Design §7.1). Every active member sees the directory fields; the
 * rest only with MEMBERS:VIEW.
 */
export class MemberDto {
  @ApiProperty() membershipId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() isOwner!: boolean;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional({ enum: ['OWNER', ...ASSIGNABLE_ROLES] }) role?: string;
  @ApiPropertyOptional({ enum: Object.values(MembershipStatus) }) status?: string;
  @ApiPropertyOptional() hasOverrides?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) invitedBy?: string | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) invitedAt?: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) acceptedAt?: Date | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) revokedAt?: Date | null;

  static from({ membership: m, displayName, email }: MemberView, details: boolean): MemberDto {
    const directory = {
      membershipId: m.id,
      userId: m.userId,
      displayName,
      isOwner: m.memberType === MemberType.Owner,
    };
    if (!details) return directory;
    return {
      ...directory,
      email,
      role: m.role,
      status: m.status,
      hasOverrides: m.memberType !== MemberType.Owner && m.permissionOverrides.length > 0,
      invitedBy: m.invitedBy ?? null,
      invitedAt: m.invitedAt ?? null,
      acceptedAt: m.acceptedAt ?? null,
      revokedAt: m.revokedAt ?? null,
    };
  }
}

/** A member's effective permissions (API Design §7.1, Database Design §8.4). */
export class MemberPermissionsDto {
  @ApiProperty() role!: string;
  @ApiProperty() isOwner!: boolean;

  @ApiProperty({
    description: '{ [module]: action[] } — only modules that grant something.',
    example: { EVENTS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'], EXPENSES: ['VIEW'] },
  })
  permissions!: Partial<Record<PermissionModule, PermissionAction[]>>;

  @ApiProperty({ type: [PermissionOverrideDto] }) overrides!: PermissionOverrideDto[];

  static from(membership: Membership, permissions: EffectivePermissions): MemberPermissionsDto {
    return {
      role: membership.role,
      isOwner: permissions.isOwner,
      permissions: permissions.toRecord(),
      overrides: permissions.isOwner ? [] : membership.permissionOverrides,
    };
  }
}

export class ListMembersQueryDto {
  @ApiPropertyOptional({ enum: LISTED_STATUSES, default: MembershipStatus.Active })
  @IsOptional()
  @IsIn(LISTED_STATUSES)
  status: (typeof LISTED_STATUSES)[number] = MembershipStatus.Active;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE, default: MAX_PAGE })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  limit: number = MAX_PAGE;

  @ApiPropertyOptional({ description: '`meta.pagination.nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/** A role change and/or a complete replacement override list; at least one (§7.1). */
export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES, {
    message: 'Choose Admin, Organizer, Editor or Viewer. Owners are made only by transfer.',
  })
  role?: AssignableRole;

  @ApiPropertyOptional({ type: [PermissionOverrideDto], maxItems: MAX_OVERRIDES })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_OVERRIDES)
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideDto)
  permissionOverrides?: PermissionOverrideDto[];
}

const AUDIT_PAGE = 50;

export class AuditLogQueryDto {
  @ApiPropertyOptional({ enum: Object.values(AuditAction) })
  @IsOptional()
  @IsIn(Object.values(AuditAction))
  action?: AuditAction;

  @ApiPropertyOptional({ example: 'wedding_membership' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Inclusive, in the wedding timezone.' })
  @IsOptional()
  @Matches(isCalendarDate, 'Enter a date as YYYY-MM-DD.')
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Inclusive, in the wedding timezone.' })
  @IsOptional()
  @Matches(isCalendarDate, 'Enter a date as YYYY-MM-DD.')
  to?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE, default: AUDIT_PAGE })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  limit: number = AUDIT_PAGE;

  @ApiPropertyOptional({ description: '`meta.pagination.nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/** One audit history entry (API Design §7.1); metadata never holds secrets (§22). */
export class AuditLogDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: Object.values(AuditAction) }) action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty() resourceId!: string;
  @ApiProperty({ type: String, nullable: true }) actorUserId!: string | null;
  @ApiProperty({ type: String, nullable: true }) actorName!: string | null;
  @ApiProperty({ type: Object }) metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: Date;

  static from(record: AuditRecord & { actorName: string | null }): AuditLogDto {
    return {
      id: record.id,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      actorUserId: record.actorUserId ?? null,
      actorName: record.actorName,
      metadata: record.metadata ?? {},
      createdAt: record.createdAt,
    };
  }
}
