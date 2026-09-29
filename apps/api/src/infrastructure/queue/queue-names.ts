/**
 * Registry of BullMQ queue names. Each domain module adds its queue here when it
 * introduces background work (invitations, reminders, reports, media cleanup, …).
 */
export const QueueName = {
  /** Infrastructure-only queue used to verify the worker pipeline end to end. */
  System: 'system',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const SystemJob = {
  Ping: 'ping',
} as const;
