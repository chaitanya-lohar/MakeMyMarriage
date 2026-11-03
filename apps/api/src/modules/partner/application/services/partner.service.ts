import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../../../config/app-config.js';
import { EmailSender } from '../../../../infrastructure/email/email-message.js';
import {
  TransactionRunner,
  type Transaction,
} from '../../../../infrastructure/database/transaction.js';
import { RateLimiter } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import {
  emailHint,
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
  isWellFormedToken,
  newInvitationToken,
  OwnershipTransfersService,
} from '../../../members/index.js';
import { normalizeEmail, UsersService } from '../../../users/index.js';
import { todayIn, WeddingsService } from '../../../weddings/index.js';
import {
  MemberType,
  MembershipsService,
  MembershipStatus,
  OWNER_SEATS,
  OwnerMembershipExistsError,
  OwnerSeatTakenError,
  weddingNotFound,
  type Membership,
} from '../../../workspace/index.js';
import { partnerInvitationEmail } from '../emails/partner-invitation.email.js';
import { PartnerErrors } from '../partner-errors.js';
import {
  PartnerLimits,
  resendRetryAfterSeconds,
  resendsLeft,
} from '../../domain/rules/partner-rules.js';
import {
  effectiveStatus,
  PartnerConnectionOpenError,
  PartnerConnectionStatus,
  type PartnerConnection,
} from '../../domain/types/partner-connection.js';
import { PartnerConnectionsRepository } from '../../infrastructure/repositories/partner-connections.repository.js';

const CONNECTION = 'partner_connection';
const MEMBERSHIP = 'wedding_membership';

/** A condition of a transaction no longer held; nothing was applied. */
class ConnectionChangedError extends Error {}

/** The wedding's other owner, as the partner card shows them (API Design §7.2, D3). */
export interface PartnerView {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
  /** When the partner invitation was accepted; null for an owner by seat transfer. */
  connectedAt: Date | null;
}

/** The latest invitation, while pending or just expired. */
export interface PartnerInvitationView {
  connection: PartnerConnection;
  status: PartnerConnectionStatus;
  resendsLeft: number;
}

export interface PartnerState {
  partner: PartnerView | null;
  invitation: PartnerInvitationView | null;
}

/** What the public invitation page shows (API Design §7.2); nothing else about the wedding. */
export interface PartnerInvitationDetails {
  weddingDisplayName: string;
  invitedByName: string;
  status: PartnerConnectionStatus;
  expiresAt: Date;
  emailHint: string;
}

/** The caller of an owner route: their ACTIVE owner membership. */
export interface PartnerCaller {
  membership: Membership;
}

/**
 * Partner connection (decision 0038, Database Design §7.3, API Design §7.2): an owner of a
 * one-owner wedding invites the partner by email; accepting makes them the second owner; either
 * owner may later leave. Every owner change bumps `weddings.ownersVersion` in its transaction,
 * so concurrent changes are serialized and never leave three owners or none.
 */
@Injectable()
export class PartnerService {
  constructor(
    private readonly connections: PartnerConnectionsRepository,
    private readonly memberships: MembershipsService,
    private readonly transfers: OwnershipTransfersService,
    private readonly users: UsersService,
    private readonly weddings: WeddingsService,
    private readonly audit: AuditService,
    private readonly sender: EmailSender,
    private readonly rateLimiter: RateLimiter,
    private readonly transactions: TransactionRunner,
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PartnerService.name);
  }

  /** The other owner, and the pending or just-expired invitation (API Design §7.2). */
  async state(
    weddingId: string,
    caller: PartnerCaller,
    now: Date = new Date(),
  ): Promise<PartnerState> {
    const owners = await this.activeOwners(weddingId);
    const other = owners.find((owner) => owner.id !== caller.membership.id);
    const open = await this.connections.findOpen(weddingId);
    let partner: PartnerView | null = null;
    if (other) {
      const user = await this.users.findById(other.userId);
      partner = {
        membershipId: other.id,
        userId: other.userId,
        displayName: user?.displayName ?? '',
        email: user?.email ?? '',
        connectedAt:
          open?.status === PartnerConnectionStatus.Active && open.membershipId === other.id
            ? (open.acceptedAt ?? null)
            : null,
      };
    }
    let invitation: PartnerInvitationView | null = null;
    if (!other) {
      const latest = await this.connections.findLatest(weddingId);
      if (latest) {
        const status = effectiveStatus(latest, now);
        if (status === PartnerConnectionStatus.Expired) await this.expire(latest, now);
        if (
          status === PartnerConnectionStatus.Pending ||
          status === PartnerConnectionStatus.Expired
        ) {
          invitation = {
            connection: latest,
            status,
            resendsLeft: resendsLeft(latest.resentAt, now),
          };
        }
      }
    }
    return { partner, invitation };
  }

  async invite(
    weddingId: string,
    caller: PartnerCaller,
    email: string,
    now: Date = new Date(),
  ): Promise<{ connection: PartnerConnection; emailSent: boolean }> {
    const inviteeEmail = normalizeEmail(email);
    const inviter = await this.users.findById(caller.membership.userId);
    if (inviter && normalizeEmail(inviter.email) === inviteeEmail) throw PartnerErrors.ownEmail();
    if ((await this.activeOwners(weddingId)).length >= OWNER_SEATS.length) {
      throw PartnerErrors.alreadyConnected();
    }
    const open = await this.connections.findOpen(weddingId);
    if (open) {
      if (effectiveStatus(open, now) !== PartnerConnectionStatus.Expired) {
        throw PartnerErrors.alreadyPending();
      }
      await this.expire(open, now);
    }

    // After the checks, so a refused request does not use a slot (as 0034 R1).
    const slot = await this.rateLimiter.take(PartnerLimits.createPerWedding, weddingId, now);
    if (!slot.allowed) throw PartnerErrors.rateLimited(slot.retryAfterSeconds);

    const token = newInvitationToken();
    let connection: PartnerConnection;
    try {
      connection = await this.connections.create({
        weddingId,
        inviteeEmail,
        tokenHash: hashInvitationToken(token),
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
        inviterUserId: caller.membership.userId,
        now,
      });
    } catch (error) {
      await this.rateLimiter.release(PartnerLimits.createPerWedding, weddingId, slot.ticket);
      if (error instanceof PartnerConnectionOpenError) throw PartnerErrors.alreadyPending();
      throw error;
    }
    await this.record(connection, caller.membership.userId, AuditAction.PartnerInvitationCreated, {
      email: inviteeEmail,
    });
    const emailSent = await this.sendEmail(connection, token);
    return { connection: { ...connection, emailSent }, emailSent };
  }

  /** A new token and seven days from now; at most three per rolling 24 hours (D4). */
  async resend(
    weddingId: string,
    caller: PartnerCaller,
    connectionId: string,
    now: Date = new Date(),
  ): Promise<{ connection: PartnerConnection; emailSent: boolean }> {
    const current = await this.pendingInWedding(weddingId, connectionId, now);
    const token = newInvitationToken();
    const resent = await this.connections.resend(
      current.id,
      hashInvitationToken(token),
      new Date(now.getTime() + INVITATION_LIFETIME_MS),
      now,
    );
    if (!resent) {
      const latest = (await this.connections.findInWedding(weddingId, connectionId)) ?? current;
      await this.assertLive(latest, now);
      throw PartnerErrors.rateLimited(resendRetryAfterSeconds(latest.resentAt, now));
    }
    await this.record(resent, caller.membership.userId, AuditAction.PartnerInvitationResent, {
      email: resent.inviteeEmail,
    });
    const emailSent = await this.sendEmail(resent, token);
    return { connection: { ...resent, emailSent }, emailSent };
  }

  async revoke(
    weddingId: string,
    caller: PartnerCaller,
    connectionId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const current = await this.pendingInWedding(weddingId, connectionId, now);
    const revoked = await this.connections.revoke(current.id, caller.membership.userId, now);
    if (!revoked) {
      const latest = (await this.connections.findInWedding(weddingId, connectionId)) ?? current;
      await this.assertLive(latest, now);
      throw PartnerErrors.notPending(effectiveStatus(latest, now));
    }
    await this.record(revoked, caller.membership.userId, AuditAction.PartnerInvitationRevoked, {
      email: revoked.inviteeEmail,
    });
  }

  /** The invitation behind a token, for its public page. */
  async details(
    token: string,
    ip: string,
    now: Date = new Date(),
  ): Promise<PartnerInvitationDetails> {
    const connection = await this.byToken(token, ip, now);
    const [wedding, inviter] = await Promise.all([
      this.weddings.findById(connection.weddingId),
      this.users.findById(connection.inviterUserId),
    ]);
    if (!wedding) throw PartnerErrors.notFound();
    return {
      weddingDisplayName: wedding.displayName,
      invitedByName: inviter?.displayName ?? '',
      status: effectiveStatus(connection, now),
      expiresAt: connection.expiresAt,
      emailHint: emailHint(connection.inviteeEmail),
    };
  }

  /**
   * Accepts as the signed-in user (D4: the account email must match; no other verification).
   * The invitee must not own a wedding (D6) and the wedding must have a free owner seat. One
   * transaction: `ownersVersion`, the invitee's membership made owner (new, promoted with
   * overrides cleared — D5 — or reactivated — D10), the connection ACTIVE, the audit entries.
   */
  async accept(
    token: string,
    ip: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<{ weddingId: string; membershipId: string }> {
    const connection = await this.byToken(token, ip, now);
    await this.assertLive(connection, now);
    const user = await this.users.findById(userId);
    if (!user || normalizeEmail(user.email) !== connection.inviteeEmail) {
      throw PartnerErrors.emailMismatch();
    }
    const weddingId = connection.weddingId;
    if (await this.memberships.ownsAWedding(userId)) {
      const here = await this.memberships.findForUser(weddingId, userId);
      throw here?.memberType === MemberType.Owner
        ? PartnerErrors.alreadyConnected()
        : PartnerErrors.inviteeOwnsWedding();
    }

    try {
      return await this.transactions.run(async (transaction) => {
        if (!(await this.weddings.bumpOwnersVersion(weddingId, transaction))) {
          throw PartnerErrors.notFound();
        }
        const owners = (await this.memberships.listOwners(weddingId, transaction)).filter(
          (owner) => owner.status === MembershipStatus.Active,
        );
        const taken = new Set(owners.map((owner) => owner.ownerSeat));
        const seat = OWNER_SEATS.find((candidate) => !taken.has(candidate));
        if (seat === undefined) throw PartnerErrors.seatUnavailable();

        const admitted = await this.memberships.admitAsPartner(
          weddingId,
          userId,
          seat,
          now,
          transaction,
        );
        if (!admitted) throw PartnerErrors.alreadyConnected();
        const accepted = await this.connections.accept(
          connection.id,
          { userId, membershipId: admitted.membership.id },
          now,
          transaction,
        );
        if (!accepted) throw new ConnectionChangedError();

        const metadata = {
          email: connection.inviteeEmail,
          membershipId: admitted.membership.id,
          userId,
          ownerSeat: seat,
        };
        await this.recordIn(
          transaction,
          accepted,
          userId,
          AuditAction.PartnerInvitationAccepted,
          metadata,
        );
        await this.recordIn(transaction, accepted, userId, AuditAction.PartnerConnected, metadata);
        if (admitted.admission !== 'CREATED') {
          await this.audit.record(
            {
              weddingId,
              actorUserId: userId,
              action:
                admitted.admission === 'PROMOTED'
                  ? AuditAction.MemberPromotedToOwner
                  : AuditAction.MemberReactivated,
              resourceType: MEMBERSHIP,
              resourceId: admitted.membership.id,
              metadata: { ...metadata, connectionId: connection.id, outcome: 'SUCCEEDED' },
            },
            transaction,
          );
        }
        return { weddingId, membershipId: admitted.membership.id };
      });
    } catch (error) {
      if (error instanceof OwnerMembershipExistsError) throw PartnerErrors.inviteeOwnsWedding();
      if (error instanceof OwnerSeatTakenError) throw PartnerErrors.seatUnavailable();
      if (error instanceof ConnectionChangedError) {
        const latest = await this.connections.findByTokenHash(hashInvitationToken(token));
        if (latest) await this.assertLive(latest, now);
        throw PartnerErrors.notFound();
      }
      throw error;
    }
  }

  /** Declines with the token alone; grants nothing. */
  async decline(token: string, ip: string, now: Date = new Date()): Promise<void> {
    const connection = await this.byToken(token, ip, now);
    await this.assertLive(connection, now);
    const declined = await this.connections.decline(hashInvitationToken(token), now);
    if (!declined) {
      const latest = await this.connections.findByTokenHash(hashInvitationToken(token));
      if (latest) await this.assertLive(latest, now);
      throw PartnerErrors.notFound();
    }
    await this.record(declined, undefined, AuditAction.PartnerInvitationDeclined, {
      email: declined.inviteeEmail,
    });
  }

  /**
   * The caller leaves the wedding (D7): one transaction — `ownersVersion`, a second ACTIVE owner
   * must remain, the caller's owner row a removed VIEWER member, the connection DISCONNECTED,
   * pending ownership offers involving the caller cancelled, the audit entry. Nothing else
   * changes: what the leaver created stays, shown as a former member.
   */
  async leave(weddingId: string, caller: PartnerCaller, now: Date = new Date()): Promise<void> {
    const { membership } = caller;
    await this.transactions.run(async (transaction) => {
      if (!(await this.weddings.bumpOwnersVersion(weddingId, transaction))) throw weddingNotFound();
      const owners = (await this.memberships.listOwners(weddingId, transaction)).filter(
        (owner) => owner.status === MembershipStatus.Active,
      );
      const remaining = owners.filter((owner) => owner.id !== membership.id);
      if (remaining.length === 0 || remaining.length === owners.length) {
        throw PartnerErrors.notConnected();
      }
      const left = await this.memberships.leaveAsOwner(
        weddingId,
        membership.id,
        membership.userId,
        now,
        transaction,
      );
      if (!left) throw PartnerErrors.notConnected();
      const connection = await this.connections.disconnect(
        weddingId,
        membership.userId,
        now,
        transaction,
      );
      await this.transfers.cancelForMembershipIn(
        weddingId,
        membership.id,
        membership.userId,
        now,
        transaction,
      );
      await this.audit.record(
        {
          weddingId,
          actorUserId: membership.userId,
          action: AuditAction.PartnerDisconnected,
          resourceType: connection ? CONNECTION : MEMBERSHIP,
          resourceId: connection?.id ?? membership.id,
          metadata: {
            membershipId: membership.id,
            userId: membership.userId,
            remainingMembershipId: remaining[0]!.id,
            outcome: 'SUCCEEDED',
          },
        },
        transaction,
      );
    });
  }

  private async activeOwners(weddingId: string): Promise<Membership[]> {
    return (await this.memberships.listOwners(weddingId)).filter(
      (owner) => owner.status === MembershipStatus.Active,
    );
  }

  /** A pending, live invitation of the wedding. */
  private async pendingInWedding(
    weddingId: string,
    connectionId: string,
    now: Date,
  ): Promise<PartnerConnection> {
    const connection = await this.connections.findInWedding(weddingId, connectionId);
    if (!connection) throw PartnerErrors.notFound();
    await this.assertLive(connection, now);
    return connection;
  }

  /** 409 unless pending and live; a stale one is written EXPIRED first. */
  private async assertLive(connection: PartnerConnection, now: Date): Promise<void> {
    const status = effectiveStatus(connection, now);
    if (status === PartnerConnectionStatus.Pending) return;
    if (status === PartnerConnectionStatus.Expired) {
      await this.expire(connection, now);
      throw PartnerErrors.expired();
    }
    throw PartnerErrors.notPending(status);
  }

  /** The invitation behind a token, after the token-route limits (API Design §28). */
  private async byToken(token: string, ip: string, now: Date): Promise<PartnerConnection> {
    const [byIp, byToken] = await Promise.all([
      this.rateLimiter.hit(PartnerLimits.perIp, ip),
      this.rateLimiter.hit(PartnerLimits.perToken, token),
    ]);
    if (byIp > PartnerLimits.perIp.limit || byToken > PartnerLimits.perToken.limit) {
      throw PartnerErrors.rateLimited();
    }
    if (!isWellFormedToken(token)) throw PartnerErrors.notFound();
    const connection = await this.connections.findByTokenHash(hashInvitationToken(token));
    if (!connection) throw PartnerErrors.notFound();
    if (effectiveStatus(connection, now) === PartnerConnectionStatus.Expired) {
      await this.expire(connection, now);
    }
    return connection;
  }

  /** Writes EXPIRED once, with its audit entry, when a request first sees it. */
  private async expire(connection: PartnerConnection, now: Date): Promise<void> {
    if (await this.connections.markExpired(connection.id, now)) {
      await this.record(connection, undefined, AuditAction.PartnerInvitationExpired, {
        email: connection.inviteeEmail,
      });
    }
  }

  /** Sends during the request (0025); a failure leaves the invitation pending to resend. */
  private async sendEmail(connection: PartnerConnection, token: string): Promise<boolean> {
    const [wedding, inviter] = await Promise.all([
      this.weddings.findById(connection.weddingId),
      this.users.findById(connection.inviterUserId),
    ]);
    if (!wedding) throw weddingNotFound();
    let sent = false;
    try {
      await this.sender.send(
        partnerInvitationEmail({
          to: connection.inviteeEmail,
          weddingName: wedding.displayName,
          invitedByName: inviter?.displayName ?? 'Your partner',
          acceptUrl: `${this.config.web.appUrl}/partner-invite/${token}`,
          expiresOn: todayIn(wedding.timezone, connection.expiresAt),
        }),
      );
      sent = true;
    } catch (error) {
      // Only the error's name: provider messages can echo the address.
      this.logger.warn(
        { connectionId: connection.id, error: (error as Error).name },
        'Partner invitation email not sent',
      );
    }
    await this.connections.setEmailSent(connection.id, sent);
    return sent;
  }

  private record(
    connection: PartnerConnection,
    actorUserId: string | undefined,
    action: AuditAction,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      weddingId: connection.weddingId,
      ...(actorUserId && { actorUserId }),
      action,
      resourceType: CONNECTION,
      resourceId: connection.id,
      metadata: { ...metadata, outcome: 'SUCCEEDED' },
    });
  }

  private recordIn(
    transaction: Transaction,
    connection: PartnerConnection,
    actorUserId: string,
    action: AuditAction,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record(
      {
        weddingId: connection.weddingId,
        actorUserId,
        action,
        resourceType: CONNECTION,
        resourceId: connection.id,
        metadata: { ...metadata, outcome: 'SUCCEEDED' },
      },
      transaction,
    );
  }
}
