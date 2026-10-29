import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  AuditService,
  InvalidAuditCursorError,
  type AuditListQuery,
  type AuditRecord,
} from '../../../audit/index.js';
import { UsersService } from '../../../users/index.js';
import { WeddingsService } from '../../../weddings/index.js';
import {
  evaluatePermissions,
  MemberType,
  MembershipsService,
  MembershipStatus,
  PermissionAction,
  PermissionModule,
  permissionDenied,
  weddingNotFound,
  type EffectivePermissions,
  type Membership,
} from '../../../workspace/index.js';
import {
  overrideProblems,
  overridesAdded,
  refuseMemberChange,
  storedOverrides,
  type MemberChange,
  type MemberChangeCaller,
  type MemberRefusal,
} from '../../domain/rules/member-authority.js';
import { startOfDayIn, nextDay } from '../../domain/rules/audit-dates.js';
import type { MemberView, MemberPage } from '../../domain/types/member.js';
import { MembersErrors } from '../members-errors.js';
import { OwnershipTransfersService } from './ownership-transfers.service.js';

const MEMBERSHIP = 'wedding_membership';

function encodeCursor(membershipId: string): string {
  return Buffer.from(membershipId).toString('base64url');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

/** The audit history filters as the API receives them (API Design §7.1). */
export interface AuditHistoryQuery extends Omit<AuditListQuery, 'from' | 'to'> {
  /** Calendar dates in the wedding's timezone, both inclusive. */
  from?: string;
  to?: string;
}

/**
 * Members of a wedding and their access (API Design §7.1, Database Design §7.2, §8): the
 * member directory, effective permissions, role and override changes, removal and the
 * audit history. Every refusal of a management action is audited.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly users: UsersService,
    private readonly weddings: WeddingsService,
    private readonly audit: AuditService,
    private readonly transfers: OwnershipTransfersService,
  ) {}

  /**
   * Members with `status`, owners first, then by display name (API Design §7.1). REVOKED
   * members are listed only with MEMBERS:VIEW.
   */
  async list(
    weddingId: string,
    caller: MemberChangeCaller,
    query: { status: MembershipStatus; limit: number; cursor?: string },
  ): Promise<MemberPage> {
    if (
      query.status !== MembershipStatus.Active &&
      !caller.permissions.has(PermissionModule.Members, PermissionAction.View)
    ) {
      throw permissionDenied();
    }
    const members = await this.views(
      await this.memberships.listForWedding(weddingId, query.status),
    );
    members.sort(
      (a, b) =>
        Number(b.membership.memberType === MemberType.Owner) -
          Number(a.membership.memberType === MemberType.Owner) ||
        a.displayName.localeCompare(b.displayName, 'en-IN') ||
        a.membership.id.localeCompare(b.membership.id),
    );
    let start = 0;
    if (query.cursor) {
      const after = decodeCursor(query.cursor);
      const index = members.findIndex((member) => member.membership.id === after);
      if (index < 0) throw MembersErrors.invalidCursor();
      start = index + 1;
    }
    const page = members.slice(start, start + query.limit);
    const last = page.at(-1);
    return {
      members: page,
      nextCursor:
        start + query.limit < members.length && last ? encodeCursor(last.membership.id) : null,
    };
  }

  /** An ACTIVE member of the wedding with their name and email, or MEMBER_NOT_FOUND. */
  async activeMember(weddingId: string, membershipId: string): Promise<MemberView> {
    const membership = await this.memberships.findInWedding(weddingId, membershipId);
    if (!membership || membership.status !== MembershipStatus.Active) {
      throw MembersErrors.notFound();
    }
    const [view] = await this.views([membership]);
    return view!;
  }

  /** The effective permissions of a member of the wedding (API Design §7.1). */
  async permissionsOf(weddingId: string, membershipId: string): Promise<EffectivePermissions> {
    const { membership } = await this.activeMember(weddingId, membershipId);
    return evaluatePermissions(membership);
  }

  /**
   * Changes a member's role and/or overrides (API Design §7.1). A role change keeps the
   * stored overrides (0035 #2); a new override list replaces the stored one, keeping only
   * entries that differ from the role's defaults.
   */
  async update(
    weddingId: string,
    caller: MemberChangeCaller,
    membershipId: string,
    change: MemberChange,
  ): Promise<MemberView> {
    const target = (await this.activeMember(weddingId, membershipId)).membership;
    if (
      (change.role !== undefined &&
        !caller.permissions.has(PermissionModule.Members, PermissionAction.ChangeRole)) ||
      (change.permissionOverrides !== undefined &&
        !caller.permissions.has(PermissionModule.Members, PermissionAction.EditPermissions))
    ) {
      await this.denied(weddingId, caller, target, 'UPDATE');
      throw permissionDenied();
    }
    if (change.permissionOverrides) {
      const problems = overrideProblems(change.permissionOverrides);
      if (problems) throw MembersErrors.invalidOverrides(problems);
    }
    const refusal = refuseMemberChange(caller, target, change);
    if (refusal) {
      await this.denied(weddingId, caller, target, 'UPDATE', refusal);
      throw permissionDenied(refusal);
    }

    const role = change.role ?? target.role;
    const permissionOverrides = change.permissionOverrides
      ? storedOverrides(role, change.permissionOverrides)
      : target.permissionOverrides;
    const updated = await this.memberships.updateAccess(weddingId, target.id, {
      role,
      permissionOverrides,
    });
    if (!updated) throw MembersErrors.notFound();

    const subject = { targetMembershipId: target.id, targetUserId: target.userId };
    if (role !== target.role) {
      await this.record(weddingId, caller, target, AuditAction.MemberRoleChanged, {
        ...subject,
        oldRole: target.role,
        newRole: role,
      });
    }
    if (change.permissionOverrides) {
      const added = overridesAdded(target.permissionOverrides, permissionOverrides);
      const removed = overridesAdded(permissionOverrides, target.permissionOverrides);
      if (added.length > 0 || removed.length > 0) {
        await this.record(weddingId, caller, target, AuditAction.MemberPermissionsChanged, {
          ...subject,
          added,
          removed,
        });
      }
    }
    const [view] = await this.views([updated]);
    return view!;
  }

  /** Removes a member: REVOKED, no access from their next request, data kept (§7.1). */
  async remove(weddingId: string, caller: MemberChangeCaller, membershipId: string) {
    const target = (await this.activeMember(weddingId, membershipId)).membership;
    const refusal = refuseMemberChange(caller, target);
    if (refusal) {
      await this.denied(weddingId, caller, target, 'REMOVE', refusal);
      throw permissionDenied(refusal);
    }
    const revoked = await this.memberships.revoke(weddingId, target.id, caller.membership.userId);
    if (!revoked) throw MembersErrors.notFound();
    // A removed member can no longer take part in an ownership offer (Database Design §7.6).
    await this.transfers.cancelForMembership(weddingId, target.id, caller.membership.userId);
    await this.record(weddingId, caller, target, AuditAction.MemberRemoved, {
      targetMembershipId: target.id,
      targetUserId: target.userId,
      role: target.role,
    });
  }

  /** The wedding's audit history, newest first, with each actor's name (API Design §7.1). */
  async auditHistory(
    weddingId: string,
    query: AuditHistoryQuery,
  ): Promise<{
    records: (AuditRecord & { actorName: string | null })[];
    nextCursor: string | null;
  }> {
    const wedding = await this.weddings.findById(weddingId);
    if (!wedding) throw weddingNotFound();
    try {
      const { from, to, ...filters } = query;
      const page = await this.audit.listForWedding(weddingId, {
        ...filters,
        ...(from && { from: startOfDayIn(from, wedding.timezone) }),
        ...(to && { to: startOfDayIn(nextDay(to), wedding.timezone) }),
      });
      const actorIds = [...new Set(page.records.flatMap((record) => record.actorUserId ?? []))];
      const users = await this.users.findManyByIds(actorIds);
      const names = new Map(users.map((user) => [user.id, user.displayName]));
      return {
        records: page.records.map((record) => ({
          ...record,
          actorName: record.actorUserId ? (names.get(record.actorUserId) ?? null) : null,
        })),
        nextCursor: page.nextCursor,
      };
    } catch (error) {
      if (error instanceof InvalidAuditCursorError) throw MembersErrors.invalidCursor();
      throw error;
    }
  }

  private async views(memberships: Membership[]): Promise<MemberView[]> {
    const users = await this.users.findManyByIds(memberships.map((m) => m.userId));
    const byId = new Map(users.map((user) => [user.id, user]));
    return memberships.map((membership) => {
      const user = byId.get(membership.userId);
      return { membership, displayName: user?.displayName ?? '', email: user?.email ?? '' };
    });
  }

  private record(
    weddingId: string,
    caller: MemberChangeCaller,
    target: Membership,
    action: AuditAction,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      weddingId,
      actorUserId: caller.membership.userId,
      action,
      resourceType: MEMBERSHIP,
      resourceId: target.id,
      metadata: { ...metadata, outcome: 'SUCCEEDED' },
    });
  }

  /** A refused management action (Database Design §22). */
  private denied(
    weddingId: string,
    caller: MemberChangeCaller,
    target: Membership,
    operation: 'UPDATE' | 'REMOVE',
    reason?: MemberRefusal,
  ): Promise<void> {
    return this.audit.record({
      weddingId,
      actorUserId: caller.membership.userId,
      action: AuditAction.PermissionDenied,
      resourceType: MEMBERSHIP,
      resourceId: target.id,
      metadata: {
        operation,
        targetMembershipId: target.id,
        targetUserId: target.userId,
        ...(reason && { reason }),
        outcome: 'DENIED',
      },
    });
  }
}
