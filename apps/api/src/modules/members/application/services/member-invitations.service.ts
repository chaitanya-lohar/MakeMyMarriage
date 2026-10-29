import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../../../config/app-config.js';
import { EmailSender } from '../../../../infrastructure/email/email-message.js';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { RateLimiter } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { normalizeEmail, UsersService } from '../../../users/index.js';
import { todayIn, WeddingsService, type Wedding } from '../../../weddings/index.js';
import {
  MembershipRole,
  MembershipsService,
  MembershipStatus,
  permissionDenied,
  weddingNotFound,
  type Membership,
  type PermissionOverride,
} from '../../../workspace/index.js';
import { memberInvitationEmail } from '../emails/member-invitation.email.js';
import { InvitationsErrors } from '../invitations-errors.js';
import { MembersErrors } from '../members-errors.js';
import {
  emailHint,
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
  InvitationLimits,
  isWellFormedToken,
  newInvitationToken,
  roleLabel,
} from '../../domain/rules/invitation-rules.js';
import {
  MemberRefusal,
  overrideProblems,
  storedOverrides,
  type AssignableRole,
  type MemberChangeCaller,
} from '../../domain/rules/member-authority.js';
import {
  effectiveStatus,
  MemberInvitationPendingError,
  MemberInvitationStatus,
  type MemberInvitation,
  type MemberInvitationPage,
} from '../../domain/types/member-invitation.js';
import {
  MemberInvitationsRepository,
  RESENDS_PER_DAY,
} from '../../infrastructure/repositories/member-invitations.repository.js';

const INVITATION = 'member_invitation';

/** The invitation stopped being live between the read and the conditional update. */
class InvitationChangedError extends Error {}
const DAY_MS = 24 * 60 * 60 * 1000;

export interface NewInvitationRequest {
  email: string;
  role: AssignableRole;
  permissionOverrides: PermissionOverride[];
  message: string | null;
}

export interface SentInvitation {
  invitation: MemberInvitation;
  emailSent: boolean;
  existingMembershipStatus: MembershipStatus | null;
}

/** What the public invitation page shows (API Design §7.1); no wedding data beyond the name. */
export interface InvitationDetails {
  weddingDisplayName: string;
  invitedByName: string;
  role: AssignableRole;
  message: string | null;
  status: MemberInvitationStatus;
  expiresAt: Date;
  emailHint: string;
}

/**
 * Organizer invitations (API Design §7.1, Database Design §7.5, decisions 0034 and 0035):
 * created and managed by members with MEMBERS:INVITE, answered through the emailed
 * single-use token. Expiry is checked on every read and in the acceptance update itself, with
 * no background job (P10-2); a pending invitation grants nothing.
 */
@Injectable()
export class MemberInvitationsService {
  constructor(
    private readonly invitations: MemberInvitationsRepository,
    private readonly memberships: MembershipsService,
    private readonly users: UsersService,
    private readonly weddings: WeddingsService,
    private readonly audit: AuditService,
    private readonly sender: EmailSender,
    private readonly rateLimiter: RateLimiter,
    private readonly transactions: TransactionRunner,
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MemberInvitationsService.name);
  }

  async create(
    weddingId: string,
    caller: MemberChangeCaller,
    request: NewInvitationRequest,
    now: Date = new Date(),
  ): Promise<SentInvitation> {
    const email = normalizeEmail(request.email);
    const problems = overrideProblems(request.permissionOverrides);
    if (problems) throw MembersErrors.invalidOverrides(problems);
    const refusal = this.refusal(caller, request.role, request.permissionOverrides);
    if (refusal) {
      await this.denied(weddingId, caller, null, 'INVITE', refusal, { email, role: request.role });
      throw permissionDenied(refusal);
    }

    const user = await this.users.findByEmail(email);
    const existing = user ? await this.membershipOf(weddingId, user.id) : null;
    if (existing?.status === MembershipStatus.Active) throw InvitationsErrors.alreadyActive();
    const pending = await this.invitations.findPendingByEmail(weddingId, email);
    if (pending) {
      if (effectiveStatus(pending, now) === MemberInvitationStatus.Pending) {
        throw InvitationsErrors.alreadyPending();
      }
      await this.expire(pending, now);
    }

    // After validation and the 409 checks, so a refused request does not use a slot (R1).
    const slot = await this.rateLimiter.take(InvitationLimits.createPerWedding, weddingId, now);
    if (!slot.allowed) throw InvitationsErrors.rateLimited(slot.retryAfterSeconds);

    const token = newInvitationToken();
    let invitation: MemberInvitation;
    try {
      invitation = await this.invitations.create({
        weddingId,
        email,
        role: request.role,
        permissionOverrides: storedOverrides(request.role, request.permissionOverrides),
        message: request.message,
        tokenHash: hashInvitationToken(token),
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
        invitedBy: caller.membership.userId,
        now,
      });
    } catch (error) {
      if (error instanceof MemberInvitationPendingError) throw InvitationsErrors.alreadyPending();
      throw error;
    }
    await this.record(invitation, caller.membership.userId, AuditAction.MemberInvitationCreated, {
      email,
      role: invitation.role,
      overrides: invitation.permissionOverrides,
    });
    const emailSent = await this.sendEmail(invitation, token, caller.membership.userId);
    return {
      invitation,
      emailSent,
      existingMembershipStatus: existing?.status ?? null,
    };
  }

  /** The wedding's invitations with `status`, newest first; stale ones are written EXPIRED. */
  async list(
    weddingId: string,
    query: { status: MemberInvitationStatus; limit: number; cursor?: string },
    now: Date = new Date(),
  ): Promise<MemberInvitationPage> {
    for (const stale of await this.invitations.listStale(weddingId, now)) {
      await this.expire(stale, now);
    }
    const page = await this.invitations.list(weddingId, query);
    if (!page) throw MembersErrors.invalidCursor();
    return page;
  }

  /** A new token, `expiresAt` = now + 7 days, the email again (0034 R2, R5). */
  async resend(
    weddingId: string,
    caller: MemberChangeCaller,
    invitationId: string,
    now: Date = new Date(),
  ): Promise<{ invitation: MemberInvitation; emailSent: boolean }> {
    const current = await this.pendingInWedding(weddingId, caller, invitationId, 'RESEND', now);
    const token = newInvitationToken();
    const resent = await this.invitations.resend(
      current.id,
      hashInvitationToken(token),
      new Date(now.getTime() + INVITATION_LIFETIME_MS),
      now,
    );
    if (!resent) {
      const latest = (await this.invitations.findInWedding(weddingId, invitationId)) ?? current;
      const status = effectiveStatus(latest, now);
      if (status !== MemberInvitationStatus.Pending) throw InvitationsErrors.notPending(status);
      const oldest = latest.resentAt.at(-RESENDS_PER_DAY) ?? now;
      throw InvitationsErrors.rateLimited(
        Math.max(1, Math.ceil((oldest.getTime() + DAY_MS - now.getTime()) / 1000)),
      );
    }
    await this.record(resent, caller.membership.userId, AuditAction.MemberInvitationResent, {
      email: resent.email,
      role: resent.role,
    });
    return {
      invitation: resent,
      emailSent: await this.sendEmail(resent, token, caller.membership.userId),
    };
  }

  async revoke(
    weddingId: string,
    caller: MemberChangeCaller,
    invitationId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const current = await this.pendingInWedding(weddingId, caller, invitationId, 'REVOKE', now);
    const revoked = await this.invitations.revoke(current.id, caller.membership.userId, now);
    if (!revoked) {
      const latest = (await this.invitations.findInWedding(weddingId, invitationId)) ?? current;
      throw InvitationsErrors.notPending(effectiveStatus(latest, now));
    }
    await this.record(revoked, caller.membership.userId, AuditAction.MemberInvitationRevoked, {
      email: revoked.email,
      role: revoked.role,
    });
  }

  /** The invitation behind a token, for its public page (API Design §7.1). */
  async details(token: string, ip: string, now: Date = new Date()): Promise<InvitationDetails> {
    const invitation = await this.byToken(token, ip, now);
    const [wedding, inviter] = await Promise.all([
      this.weddings.findById(invitation.weddingId),
      this.users.findById(invitation.invitedBy),
    ]);
    if (!wedding) throw InvitationsErrors.notFound();
    return {
      weddingDisplayName: wedding.displayName,
      invitedByName: inviter?.displayName ?? '',
      role: invitation.role,
      message: invitation.message,
      status: effectiveStatus(invitation, now),
      expiresAt: invitation.expiresAt,
      emailHint: emailHint(invitation.email),
    };
  }

  /**
   * Accepts as the signed-in user (P10-1: the account email must match; no verification).
   * One transaction: the membership created or a removed member's row reused (P10-3), the
   * invitation ACCEPTED only while live, and the audit entries.
   */
  async accept(
    token: string,
    ip: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<{ weddingId: string; membershipId: string; role: MembershipRole }> {
    const invitation = await this.byToken(token, ip, now);
    const user = await this.users.findById(userId);
    if (!user || normalizeEmail(user.email) !== invitation.email) {
      throw InvitationsErrors.emailMismatch();
    }
    await this.assertLive(invitation, now);

    const membership = await this.transactions
      .run(async (transaction) => {
        const admitted = await this.memberships.admitFromInvitation(
          invitation.weddingId,
          userId,
          {
            role: invitation.role,
            permissionOverrides: invitation.permissionOverrides,
            invitationId: invitation.id,
            invitedBy: invitation.invitedBy,
            invitedAt: invitation.createdAt,
          },
          now,
          transaction,
        );
        if (!admitted) throw InvitationsErrors.alreadyActive();
        const accepted = await this.invitations.accept(
          hashInvitationToken(token),
          { userId, membershipId: admitted.membership.id },
          now,
          transaction,
        );
        // Expired or answered since it was read: nothing is applied.
        if (!accepted) throw new InvitationChangedError();
        const subject = {
          weddingId: invitation.weddingId,
          actorUserId: userId,
          metadata: {
            email: invitation.email,
            role: invitation.role,
            membershipId: admitted.membership.id,
            outcome: 'SUCCEEDED',
          },
        };
        await this.audit.record(
          {
            ...subject,
            action: AuditAction.MemberInvitationAccepted,
            resourceType: INVITATION,
            resourceId: invitation.id,
          },
          transaction,
        );
        if (admitted.reactivated) {
          await this.audit.record(
            {
              ...subject,
              action: AuditAction.MemberReactivated,
              resourceType: 'wedding_membership',
              resourceId: admitted.membership.id,
            },
            transaction,
          );
        }
        return admitted.membership;
      })
      .catch((error: unknown) => this.explainChange(error, token, now));
    return {
      weddingId: membership.weddingId,
      membershipId: membership.id,
      role: membership.role,
    };
  }

  /** Declines with the token alone (0034 R6); grants nothing. */
  async decline(token: string, ip: string, now: Date = new Date()): Promise<void> {
    const invitation = await this.byToken(token, ip, now);
    await this.assertLive(invitation, now);
    const declined = await this.invitations.decline(hashInvitationToken(token), now);
    if (!declined) return this.explainChange(new InvitationChangedError(), token, now);
    await this.record(declined, undefined, AuditAction.MemberInvitationDeclined, {
      email: declined.email,
      role: declined.role,
    });
  }

  /**
   * Rethrows `error`, replacing an InvitationChangedError — the invitation stopped being live
   * between the read and the conditional update — with the error its current status calls for.
   */
  private async explainChange(error: unknown, token: string, now: Date): Promise<never> {
    if (!(error instanceof InvitationChangedError)) throw error;
    const latest = await this.invitations.findByTokenHash(hashInvitationToken(token));
    if (latest) await this.assertLive(latest, now);
    throw InvitationsErrors.notFound();
  }

  /** P10-4 for a non-owner: never the ADMIN role, never an ALLOW beyond their own. */
  private refusal(
    caller: MemberChangeCaller,
    role: AssignableRole,
    overrides: readonly PermissionOverride[],
  ): MemberRefusal | null {
    if (caller.permissions.isOwner) return null;
    if (role === MembershipRole.Admin) return MemberRefusal.AdminRoleOwnerOnly;
    const exceeds = overrides.some(
      (o) => o.effect === 'ALLOW' && !caller.permissions.has(o.module, o.action),
    );
    return exceeds ? MemberRefusal.GrantExceedsCaller : null;
  }

  /** A PENDING invitation of the wedding that the caller may resend or revoke. */
  private async pendingInWedding(
    weddingId: string,
    caller: MemberChangeCaller,
    invitationId: string,
    operation: 'RESEND' | 'REVOKE',
    now: Date,
  ): Promise<MemberInvitation> {
    const invitation = await this.invitations.findInWedding(weddingId, invitationId);
    if (!invitation) throw InvitationsErrors.notFound();
    if (!caller.permissions.isOwner && invitation.role === MembershipRole.Admin) {
      await this.denied(weddingId, caller, invitation, operation, MemberRefusal.AdminRoleOwnerOnly);
      throw permissionDenied(MemberRefusal.AdminRoleOwnerOnly);
    }
    await this.assertLive(invitation, now);
    return invitation;
  }

  /** 409 unless the invitation is pending; a stale one is written EXPIRED first. */
  private async assertLive(invitation: MemberInvitation, now: Date): Promise<void> {
    const status = effectiveStatus(invitation, now);
    if (status === MemberInvitationStatus.Pending) return;
    if (status === MemberInvitationStatus.Expired) {
      await this.expire(invitation, now);
      throw InvitationsErrors.expired();
    }
    throw InvitationsErrors.notPending(status);
  }

  /** The invitation behind a token, after the token-route limits (API Design §28). */
  private async byToken(token: string, ip: string, now: Date): Promise<MemberInvitation> {
    const [byIp, byToken] = await Promise.all([
      this.rateLimiter.hit(InvitationLimits.perIp, ip),
      this.rateLimiter.hit(InvitationLimits.perToken, token),
    ]);
    if (byIp > InvitationLimits.perIp.limit || byToken > InvitationLimits.perToken.limit) {
      throw InvitationsErrors.rateLimited();
    }
    if (!isWellFormedToken(token)) throw InvitationsErrors.notFound();
    const invitation = await this.invitations.findByTokenHash(hashInvitationToken(token));
    if (!invitation) throw InvitationsErrors.notFound();
    if (
      invitation.status === MemberInvitationStatus.Pending &&
      effectiveStatus(invitation, now) === MemberInvitationStatus.Expired
    ) {
      await this.expire(invitation, now);
    }
    return invitation;
  }

  /** Writes EXPIRED once, with its audit entry, when a request first sees it (P10-2). */
  private async expire(invitation: MemberInvitation, now: Date): Promise<void> {
    if (await this.invitations.markExpired(invitation.id, now)) {
      await this.record(invitation, undefined, AuditAction.MemberInvitationExpired, {
        email: invitation.email,
        role: invitation.role,
      });
    }
  }

  private async membershipOf(weddingId: string, userId: string): Promise<Membership | null> {
    const active = await this.memberships.findActive(userId, weddingId);
    if (active) return active;
    const revoked = await this.memberships.listForWedding(weddingId, MembershipStatus.Revoked);
    return revoked.find((membership) => membership.userId === userId) ?? null;
  }

  /** Sends during the request (0025); a failure leaves the invitation pending to resend. */
  private async sendEmail(
    invitation: MemberInvitation,
    token: string,
    invitedByUserId: string,
  ): Promise<boolean> {
    const [wedding, inviter] = await Promise.all([
      this.weddings.findById(invitation.weddingId),
      this.users.findById(invitedByUserId),
    ]);
    if (!wedding) throw weddingNotFound();
    try {
      await this.sender.send(
        memberInvitationEmail({
          to: invitation.email,
          weddingName: wedding.displayName,
          invitedByName: inviter?.displayName ?? 'A member',
          roleLabel: roleLabel(invitation.role),
          message: invitation.message,
          acceptUrl: `${this.config.web.appUrl}/member-invite/${token}`,
          expiresOn: expiryDate(invitation, wedding),
        }),
      );
      return true;
    } catch (error) {
      // Only the error's name: provider messages can echo the address.
      this.logger.warn(
        { invitationId: invitation.id, error: (error as Error).name },
        'Invitation email not sent',
      );
      return false;
    }
  }

  private record(
    invitation: MemberInvitation,
    actorUserId: string | undefined,
    action: AuditAction,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      weddingId: invitation.weddingId,
      ...(actorUserId && { actorUserId }),
      action,
      resourceType: INVITATION,
      resourceId: invitation.id,
      metadata: { ...metadata, outcome: 'SUCCEEDED' },
    });
  }

  private denied(
    weddingId: string,
    caller: MemberChangeCaller,
    invitation: MemberInvitation | null,
    operation: 'INVITE' | 'RESEND' | 'REVOKE',
    reason: MemberRefusal,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    return this.audit.record({
      weddingId,
      actorUserId: caller.membership.userId,
      action: AuditAction.PermissionDenied,
      resourceType: invitation ? INVITATION : 'wedding_membership',
      resourceId: invitation?.id ?? caller.membership.id,
      metadata: { ...metadata, operation, reason, outcome: 'DENIED' },
    });
  }
}

/** The expiry's calendar date in the wedding's timezone, for the email. */
function expiryDate(invitation: MemberInvitation, wedding: Wedding): string {
  return todayIn(wedding.timezone, invitation.expiresAt);
}
