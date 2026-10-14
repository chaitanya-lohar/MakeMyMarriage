import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../../../config/app-config.js';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { EmailRejectedError, EmailSender } from '../../../../infrastructure/email/email-message.js';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module.js';
import { GuestsService } from '../../../guests/index.js';
import { WeddingsService } from '../../../weddings/index.js';
import {
  AttemptStatus,
  DeliveryStatus,
  type AttemptOutcome,
  type DeliveryKind,
} from '../../domain/types/invitation.js';
import { GuestInvitationsRepository } from '../../infrastructure/repositories/guest-invitations.repository.js';
import { InvitationHistoryRepository } from '../../infrastructure/repositories/invitation-history.repository.js';
import { invitationEmail } from '../emails/invitation.email.js';
import { InvitationTokensService } from './invitation-tokens.service.js';

/** Recorded when the provider could not be reached, so it neither accepted nor rejected. */
export const UNREACHABLE_REASON = 'The email service could not be reached.';

/** How long an attempt key stays claimed, so a repeated request cannot send twice. */
const ATTEMPT_CLAIM_SECONDS = 24 * 60 * 60;

export interface InvitationEmailRequest {
  weddingId: string;
  invitationId: string;
  kind: DeliveryKind;
  /** Unique per attempt; repeated requests with the same key send at most once. */
  attemptKey: string;
  /** The link the email is for: the token's creation time when the request was checked. */
  tokenCreatedAt: Date;
}

/**
 * Sends an invitation email during the request and records the attempt (Phase 4 PRD §7.3,
 * decisions 0017 #10–11, 0018 #8, 0020, 0025).
 *
 * Builds the link from the stored encrypted token, so resends reuse the same token. Each
 * attempt becomes an `invitation_deliveries` record: SENT when the provider accepts it, FAILED
 * when it rejects it or cannot be reached. There is no automatic retry; the organizer resends
 * (0025). The invitation's status follows the latest attempt. Never DELIVERED. Never logs the
 * token, link or address.
 */
@Injectable()
export class InvitationEmailService {
  constructor(
    private readonly invitations: GuestInvitationsRepository,
    private readonly history: InvitationHistoryRepository,
    private readonly tokens: InvitationTokensService,
    private readonly guests: GuestsService,
    private readonly weddings: WeddingsService,
    private readonly sender: EmailSender,
    private readonly transactions: TransactionRunner,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(InvitationEmailService.name);
  }

  async send(request: InvitationEmailRequest): Promise<void> {
    const { weddingId, invitationId, kind, attemptKey } = request;
    const log = { invitationId };

    // Claimed before sending, so two identical requests arriving together send once; the
    // recorded attempt covers repeats after the claim expires.
    const claimed = await this.redis.set(
      `invitation-attempt:${attemptKey}`,
      '1',
      'EX',
      ATTEMPT_CLAIM_SECONDS,
      'NX',
    );
    if (claimed !== 'OK' || (await this.history.hasAttempt(attemptKey))) return;

    // Revoked, regenerated or deleted since the request was checked: the link is no longer
    // current, so nothing is sent or recorded (0020).
    const secret = await this.invitations.findSecretById(invitationId);
    const sameLink =
      secret?.invitation.tokenCreatedAt?.getTime() === request.tokenCreatedAt.getTime();
    const guest =
      secret && sameLink
        ? await this.guests.findActive(weddingId, secret.invitation.guestId)
        : null;
    const wedding = await this.weddings.findById(weddingId);
    if (!secret || !sameLink || !guest?.email || !wedding) {
      this.logger.info(log, 'Invitation email skipped: no longer sendable');
      return;
    }

    const token = this.tokens.decrypt(secret.tokenCiphertext, secret.tokenKeyVersion, guest.id);
    if (!token) throw new Error('The invitation token could not be decrypted');

    const message = invitationEmail({
      to: guest.email,
      guestName: guest.name,
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      weddingDate: wedding.startDate,
      city: wedding.primaryCity,
      invitationUrl: `${this.config.web.appUrl}/invite/${token}`,
    });

    let outcome: AttemptOutcome;
    try {
      const result = await this.sender.send(message);
      outcome = { status: AttemptStatus.Sent, providerMessageId: result.providerMessageId };
    } catch (error) {
      if (error instanceof EmailRejectedError) {
        outcome = { status: AttemptStatus.Failed, failureReason: error.reason };
      } else {
        // Only the error's name: provider messages can echo request content.
        this.logger.warn({ ...log, error: (error as Error).name }, 'Email service unreachable');
        outcome = { status: AttemptStatus.Failed, failureReason: UNREACHABLE_REASON };
      }
    }

    const at = new Date();
    const applied = await this.transactions.run(async (transaction) => {
      // The attempt happened, so it is always recorded; history is never rewritten (0020).
      await this.history.recordAttempt(
        {
          weddingId,
          invitationId,
          kind,
          provider: this.sender.providerName,
          idempotencyKey: attemptKey,
          outcome,
          at,
        },
        transaction,
      );
      // The status follows it only if the emailed link is still current: a link regenerated or
      // revoked during the send keeps the status 0020 gave it, so nobody is told it was sent.
      return this.invitations.applyAttempt(
        invitationId,
        request.tokenCreatedAt,
        outcome.status === AttemptStatus.Sent ? DeliveryStatus.Sent : DeliveryStatus.Failed,
        outcome.status === AttemptStatus.Sent ? at : null,
        transaction,
      );
    });
    this.logger.info(
      { ...log, status: outcome.status, statusUpdated: applied },
      'Invitation email attempt recorded',
    );
  }
}
