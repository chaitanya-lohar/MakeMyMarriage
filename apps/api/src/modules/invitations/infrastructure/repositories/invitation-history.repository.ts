import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import {
  ActivityType,
  AttemptStatus,
  type DeliveryKind,
  type AttemptOutcome,
  type InvitationActivity,
  type InvitationDelivery,
} from '../../domain/types/invitation.js';
import { InvitationActivityRecord } from '../schemas/invitation-activity.schema.js';
import {
  InvitationDeliveryRecord,
  type InvitationDeliveryDocument,
} from '../schemas/invitation-delivery.schema.js';

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

function toDelivery(document: InvitationDeliveryDocument): InvitationDelivery {
  return {
    attemptNumber: document.attemptNumber,
    kind: document.kind,
    status: document.status,
    sentAt: document.sentAt ?? null,
    failedAt: document.failedAt ?? null,
    failureReason: document.failureReason ?? null,
    createdAt: document.createdAt,
  };
}

export interface NewAttempt {
  weddingId: string;
  invitationId: string;
  kind: DeliveryKind;
  provider: string;
  idempotencyKey: string;
  outcome: AttemptOutcome;
  at: Date;
}

/**
 * Data access for `invitation_deliveries` and `invitation_activities` — the invitation's
 * append-only history (0020: never rewritten).
 */
@Injectable()
export class InvitationHistoryRepository {
  constructor(
    @InjectModel(InvitationDeliveryRecord.name)
    private readonly deliveries: Model<InvitationDeliveryRecord>,
    @InjectModel(InvitationActivityRecord.name)
    private readonly activities: Model<InvitationActivityRecord>,
  ) {}

  async hasAttempt(idempotencyKey: string): Promise<boolean> {
    return (await this.deliveries.exists({ idempotencyKey })) !== null;
  }

  /** Records an attempt with the next attempt number for its invitation. */
  async recordAttempt(attempt: NewAttempt, transaction?: Transaction): Promise<void> {
    const session = sessionOf(transaction);
    const previous = await this.deliveries
      .countDocuments({ guestInvitationId: oid(attempt.invitationId) })
      .session(session ?? null);
    const { outcome } = attempt;
    await this.deliveries.create(
      [
        {
          weddingId: oid(attempt.weddingId),
          guestInvitationId: oid(attempt.invitationId),
          channel: 'EMAIL',
          attemptNumber: previous + 1,
          kind: attempt.kind,
          provider: attempt.provider,
          status: outcome.status,
          idempotencyKey: attempt.idempotencyKey,
          ...(outcome.status === AttemptStatus.Sent
            ? {
                sentAt: attempt.at,
                ...(outcome.providerMessageId
                  ? { providerMessageId: outcome.providerMessageId }
                  : {}),
              }
            : { failedAt: attempt.at, failureReason: outcome.failureReason }),
        },
      ],
      { session },
    );
  }

  async listDeliveries(invitationId: string): Promise<InvitationDelivery[]> {
    const documents = await this.deliveries
      .find({ guestInvitationId: oid(invitationId) })
      .sort({ createdAt: 1, _id: 1 });
    return documents.map(toDelivery);
  }

  async recordOpen(weddingId: string, invitationId: string, at: Date): Promise<void> {
    await this.activities.create({
      weddingId: oid(weddingId),
      guestInvitationId: oid(invitationId),
      type: ActivityType.Opened,
      occurredAt: at,
    });
  }

  async listActivities(invitationId: string): Promise<InvitationActivity[]> {
    const documents = await this.activities
      .find({ guestInvitationId: oid(invitationId) })
      .sort({ occurredAt: 1, _id: 1 });
    return documents.map((document) => ({ type: document.type, occurredAt: document.occurredAt }));
  }
}
