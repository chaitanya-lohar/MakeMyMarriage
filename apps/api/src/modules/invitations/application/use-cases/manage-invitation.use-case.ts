import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AppConfig } from '../../../../config/app-config.js';
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
import { InvitationEmailService } from '../services/invitation-email.service.js';
import { InvitationTokensService } from '../services/invitation-tokens.service.js';

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
    private readonly emails: InvitationEmailService,
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
   * Sends the invitation email and records the attempt before responding (202, decision 0025),
   * so the returned invitation already shows SENT or FAILED. The same Idempotency-Key sends it
   * at most once.
   */
  async sendEmail(
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

    // Hashed, so the stored key never repeats what the client sent.
    const key = createHash('sha256')
      .update(idempotencyKey ?? randomUUID())
      .digest('base64url')
      .slice(0, 32);
    await this.emails.send({
      weddingId,
      invitationId: invitation.id,
      kind,
      attemptKey: `invitation-${invitation.id}-${key}`,
      // Set for every active link (only a revoked one lacks it, and that is refused above).
      tokenCreatedAt: invitation.tokenCreatedAt as Date,
    });
    return (await this.invitations.findForGuest(weddingId, guestId)) ?? invitation;
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
