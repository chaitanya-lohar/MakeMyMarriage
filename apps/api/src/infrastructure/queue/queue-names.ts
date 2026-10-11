/**
 * Registry of BullMQ queue names. Each domain module adds its queue here when it
 * introduces background work (invitations, reminders, reports, media cleanup, …).
 */
export const QueueName = {
  /** Infrastructure-only queue used to verify the worker pipeline end to end. */
  System: 'system',
  /** Outgoing transactional email, sent by the worker (infrastructure/email). */
  Email: 'email',
  /** Invitation emails: the worker builds each from the stored token (Phase 4, 0018). */
  Invitations: 'invitations',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const SystemJob = {
  Ping: 'ping',
} as const;

export const EmailJob = {
  Send: 'send',
} as const;

export const InvitationJob = {
  Send: 'send',
} as const;
