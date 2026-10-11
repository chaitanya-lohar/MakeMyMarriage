import { Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError, type Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../../../config/app-config.js';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { EmailRejectedError, EmailSender } from '../../../../infrastructure/email/email-message.js';
import { InvitationJob, QueueName } from '../../../../infrastructure/queue/queue-names.js';
import { GuestsService } from '../../../guests/index.js';
import { WeddingsService } from '../../../weddings/index.js';
import {
  AttemptStatus,
  DeliveryStatus,
  type AttemptOutcome,
} from '../../domain/types/invitation.js';
import { GuestInvitationsRepository } from '../../infrastructure/repositories/guest-invitations.repository.js';
import { InvitationHistoryRepository } from '../../infrastructure/repositories/invitation-history.repository.js';
import { invitationEmail } from '../emails/invitation.email.js';
import type { InvitationEmailJob } from '../use-cases/manage-invitation.use-case.js';
import { InvitationTokensService } from './invitation-tokens.service.js';

/** Recorded when every retry failed before the provider accepted or rejected the message. */
export const UNREACHABLE_REASON = 'The email service could not be reached.';

/**
 * Worker-side invitation email (Phase 4 PRD §7.3, decisions 0017 #10–11, 0018 #8).
 *
 * Builds the link from the stored encrypted token, so resends reuse the same token. Each
 * attempt becomes an `invitation_deliveries` record: SENT when the provider accepts it, FAILED
 * when it rejects it immediately — and FAILED when retries run out, since the provider never
 * accepted it. The invitation's status follows the latest attempt. Never DELIVERED. The
 * idempotency key makes the job safe to retry. Never logs the token, link or address.
 */
@Processor(QueueName.Invitations)
export class InvitationEmailProcessor extends WorkerHost {
  constructor(
    private readonly invitations: GuestInvitationsRepository,
    private readonly history: InvitationHistoryRepository,
    private readonly tokens: InvitationTokensService,
    private readonly guests: GuestsService,
    private readonly weddings: WeddingsService,
    private readonly sender: EmailSender,
    private readonly transactions: TransactionRunner,
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(InvitationEmailProcessor.name);
  }

  async process(job: Job<InvitationEmailJob>): Promise<void> {
    if (job.name !== InvitationJob.Send) {
      throw new UnrecoverableError(`Unknown job "${job.name}" on queue "${job.queueName}"`);
    }
    const { weddingId, invitationId, kind, idempotencyKey } = job.data;
    const log = { jobId: job.id, invitationId };

    if (await this.history.hasAttempt(idempotencyKey)) return;

    // Revoked, regenerated or deleted since queueing: the link this email was queued for is no
    // longer current, so nothing is sent or recorded (0020).
    const secret = await this.invitations.findSecretById(invitationId);
    const linkTime = secret?.invitation.tokenCreatedAt;
    const queuedFor = new Date(job.data.tokenCreatedAt);
    const sameLink = linkTime?.getTime() === queuedFor.getTime();
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
    if (!token) throw new UnrecoverableError('The invitation token could not be decrypted');

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
      } else if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        outcome = { status: AttemptStatus.Failed, failureReason: UNREACHABLE_REASON };
      } else {
        throw error; // Retried with the queue's backoff.
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
          idempotencyKey,
          outcome,
          at,
        },
        transaction,
      );
      // The status follows it only if the emailed link is still current: a link regenerated or
      // revoked during the send keeps the status 0020 gave it, so nobody is told it was sent.
      return this.invitations.applyAttempt(
        invitationId,
        queuedFor,
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
