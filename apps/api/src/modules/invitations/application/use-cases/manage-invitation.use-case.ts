import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';
import { AppConfig } from '../../../../config/app-config.js';
import { InvitationJob, QueueName } from '../../../../infrastructure/queue/queue-names.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { GuestsService } from '../../../guests/index.js';
import type {
  DeliveryKind,
  Invitation,
  InvitationActivity,
  InvitationDelivery,
} from '../../domain/types/invitation.js';
import {
  GuestInvitationsRepository,
  InvitationExistsError,
} from '../../infrastructure/repositories/guest-invitations.repository.js';
import { InvitationHistoryRepository } from '../../infrastructure/repositories/invitation-history.repository.js';
import { InvitationsErrors } from '../invitations-errors.js';
import { InvitationTokensService } from '../services/invitation-tokens.service.js';

/** The invitation-email job (worker: InvitationEmailProcessor). Carries no token or address. */
export interface InvitationEmailJob {
  weddingId: string;
  invitationId: string;
  kind: DeliveryKind;
  idempotencyKey: string;
  /**
   * Which link the email was queued for: the token's creation time (ISO). The worker sends only
   * while this link is still current, so a revoke or regenerate after queueing is respected.
   */
  tokenCreatedAt: string;
}

export interface InvitationWithLink {
  invitation: Invitation;
  invitationUrl: string;
}

/**
 * Organizer invitation operations (API Design §10, decisions 0017–0020). Membership is checked
 * by WeddingAccessGuard. Token regeneration and revocation and every link retrieval are
 * audited (Database Design §22); no form of the token is ever logged.
 */
@Injectable()
export class ManageInvitationUseCase {
  constructor(
    private readonly invitations: GuestInvitationsRepository,
    private readonly records: InvitationHistoryRepository,
    private readonly tokens: InvitationTokensService,
    private readonly guests: GuestsService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    @InjectQueue(QueueName.Invitations) private readonly queue: Queue<InvitationEmailJob>,
  ) {}

  /** The invitation and its first token; only now is a token created (0017 #6). */
  async create(weddingId: string, guestId: string, userId: string): Promise<InvitationWithLink> {
    await this.guests.getActive(weddingId, guestId);
    const { token, stored } = this.tokens.issue(guestId);
    try {
      const invitation = await this.invitations.create(weddingId, guestId, userId, stored);
      return { invitation, invitationUrl: this.linkFor(token) };
    } catch (error) {
      if (error instanceof InvitationExistsError) throw InvitationsErrors.alreadyExists();
      throw error;
    }
  }

  /** A new token, also from a revoked link; the old one stops working; status DRAFT (0020). */
  async regenerate(
    weddingId: string,
    guestId: string,
    userId: string,
  ): Promise<InvitationWithLink> {
    await this.guests.getActive(weddingId, guestId);
    const { token, stored } = this.tokens.issue(guestId);
    const invitation = await this.invitations.replaceToken(weddingId, guestId, stored);
    if (!invitation) throw InvitationsErrors.notFound();
    await this.audit.record({
      weddingId,
      actorUserId: userId,
      action: AuditAction.InvitationTokenRegenerated,
      resourceType: 'guest_invitation',
      resourceId: invitation.id,
    });
    return { invitation, invitationUrl: this.linkFor(token) };
  }

  /** Revokes the token; the delivery status is unchanged (0020). Repeating it changes nothing. */
  async revoke(weddingId: string, guestId: string, userId: string): Promise<Invitation> {
    await this.guests.getActive(weddingId, guestId);
    const result = await this.invitations.revoke(weddingId, guestId);
    if (!result) throw InvitationsErrors.notFound();
    if (result.revoked) {
      await this.audit.record({
        weddingId,
        actorUserId: userId,
        action: AuditAction.InvitationTokenRevoked,
        resourceType: 'guest_invitation',
        resourceId: result.invitation.id,
        metadata: { reason: 'ORGANIZER' },
      });
    }
    return result.invitation;
  }

  /** The current link for Copy Link and WhatsApp; never creates a token (0019). */
  async link(weddingId: string, guestId: string, userId: string): Promise<string> {
    await this.guests.getActive(weddingId, guestId);
    const token = await this.currentToken(weddingId, guestId);
    const invitation = await this.invitations.findForGuest(weddingId, guestId);
    await this.audit.record({
      weddingId,
      actorUserId: userId,
      action: AuditAction.InvitationLinkRetrieved,
      resourceType: 'guest_invitation',
      resourceId: (invitation as Invitation).id,
    });
    return this.linkFor(token);
  }

  /**
   * Queues the invitation email (202). The worker sends it and records the attempt. The same
   * Idempotency-Key queues it at most once.
   */
  async queueEmail(
    weddingId: string,
    guestId: string,
    kind: DeliveryKind,
    idempotencyKey: string | undefined,
  ): Promise<Invitation> {
    if (idempotencyKey !== undefined && !/^[\x21-\x7e]{1,200}$/.test(idempotencyKey)) {
      throw InvitationsErrors.invalidIdempotencyKey();
    }
    const guest = await this.guests.getActive(weddingId, guestId);
    const invitation = await this.invitations.findForGuest(weddingId, guestId);
    if (!invitation) throw InvitationsErrors.notFound();
    if (invitation.isRevoked) throw InvitationsErrors.revoked();
    if (!guest.email) throw InvitationsErrors.emailRequired();

    // BullMQ ignores a job whose ID it already holds; the worker also skips a key it has
    // already recorded. Custom job IDs cannot contain ":".
    const key = createHash('sha256')
      .update(idempotencyKey ?? randomUUID())
      .digest('base64url')
      .slice(0, 32);
    const jobId = `invitation-${invitation.id}-${key}`;
    await this.queue.add(
      InvitationJob.Send,
      {
        weddingId,
        invitationId: invitation.id,
        kind,
        idempotencyKey: jobId,
        // Set for every active link (only a revoked one lacks it, and that is refused above).
        tokenCreatedAt: (invitation.tokenCreatedAt as Date).toISOString(),
      },
      { jobId },
    );
    return invitation;
  }

  async history(
    weddingId: string,
    guestId: string,
  ): Promise<{ deliveries: InvitationDelivery[]; activities: InvitationActivity[] }> {
    await this.guests.getActive(weddingId, guestId);
    const invitation = await this.invitations.findForGuest(weddingId, guestId);
    if (!invitation) throw InvitationsErrors.notFound();
    const [deliveries, activities] = await Promise.all([
      this.records.listDeliveries(invitation.id),
      this.records.listActivities(invitation.id),
    ]);
    return { deliveries, activities };
  }

  private async currentToken(weddingId: string, guestId: string): Promise<string> {
    const secret = await this.invitations.findSecretForGuest(weddingId, guestId);
    if (!secret) {
      const invitation = await this.invitations.findForGuest(weddingId, guestId);
      throw invitation ? InvitationsErrors.revoked() : InvitationsErrors.notFound();
    }
    const token = this.tokens.decrypt(secret.tokenCiphertext, secret.tokenKeyVersion, guestId);
    // Unreachable unless the key ring lost the key that encrypted this token.
    if (!token) throw new Error('The invitation token could not be decrypted');
    return token;
  }

  private linkFor(token: string): string {
    return `${this.config.web.appUrl}/invite/${token}`;
  }
}
