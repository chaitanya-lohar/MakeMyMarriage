/**
 * Audited actions. Phase 4 audits organizer RSVP resets (0018), invitation token
 * regeneration and revocation, and every invitation link retrieval (0019) — Database
 * Design §22. Later modules add their own actions.
 */
export const AuditAction = {
  RsvpResetToPending: 'RSVP_RESET_TO_PENDING',
  InvitationTokenRegenerated: 'INVITATION_TOKEN_REGENERATED',
  InvitationTokenRevoked: 'INVITATION_TOKEN_REVOKED',
  InvitationLinkRetrieved: 'INVITATION_LINK_RETRIEVED',
  /** Phase 7: other task changes are in the task's own history (decision 0026 #17). */
  TaskDeleted: 'TASK_DELETED',
  /** Phase 8: every expense and payment change is audited; there is no history (0028 #18). */
  ExpenseCreated: 'EXPENSE_CREATED',
  ExpenseUpdated: 'EXPENSE_UPDATED',
  ExpenseDeleted: 'EXPENSE_DELETED',
  ExpenseEventUnlinked: 'EXPENSE_EVENT_UNLINKED',
  ExpensePaymentAdded: 'EXPENSE_PAYMENT_ADDED',
  ExpensePaymentUpdated: 'EXPENSE_PAYMENT_UPDATED',
  /** Keeps the removed payment's details; the entry's time is the removal time. */
  ExpensePaymentRemoved: 'EXPENSE_PAYMENT_REMOVED',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** One audit entry (Database Design §22). Metadata never holds secrets or tokens. */
export interface AuditEntry {
  weddingId?: string;
  actorUserId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRecord extends AuditEntry {
  id: string;
  createdAt: Date;
}
