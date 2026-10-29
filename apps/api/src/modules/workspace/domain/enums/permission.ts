/** Database Design §8.1 modules (permission keys). */
export const PermissionModule = {
  WeddingSettings: 'WEDDING_SETTINGS',
  Events: 'EVENTS',
  Guests: 'GUESTS',
  /** Invitations and organizer RSVP changes. */
  Invitations: 'INVITATIONS',
  Tasks: 'TASKS',
  Expenses: 'EXPENSES',
  Vendors: 'VENDORS',
  Website: 'WEBSITE',
  Gallery: 'GALLERY',
  MemoryQr: 'MEMORY_QR',
  LiveStream: 'LIVE_STREAM',
  Reports: 'REPORTS',
  /** Organizer management. */
  Members: 'MEMBERS',
  Audit: 'AUDIT',
  PartnerSharing: 'PARTNER_SHARING',
} as const;
export type PermissionModule = (typeof PermissionModule)[keyof typeof PermissionModule];

/**
 * Database Design §8.1 actions: the ordinary VIEW, CREATE, EDIT and DELETE, and the
 * module-specific management actions, which the ordinary ones never imply.
 */
export const PermissionAction = {
  View: 'VIEW',
  Create: 'CREATE',
  Edit: 'EDIT',
  Delete: 'DELETE',
  /** WEBSITE: website settings. */
  Configure: 'CONFIGURE',
  /** WEBSITE: publish and unpublish. */
  Publish: 'PUBLISH',
  /** MEMORY_QR: replace a QR token (P10-6). */
  Regenerate: 'REGENERATE',
  /** REPORTS. */
  Export: 'EXPORT',
  /** MEMBERS. */
  Invite: 'INVITE',
  ChangeRole: 'CHANGE_ROLE',
  EditPermissions: 'EDIT_PERMISSIONS',
  Remove: 'REMOVE',
  /** INVITATIONS: send, resend, retrieve or copy a guest link (P10-6, R4). */
  Send: 'SEND',
  /** INVITATIONS: regenerate or revoke a guest link (P10-6). */
  Manage: 'MANAGE',
} as const;
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

/** Database Design §8.4 override effects. */
export const PermissionEffect = {
  Allow: 'ALLOW',
  Deny: 'DENY',
} as const;
export type PermissionEffect = (typeof PermissionEffect)[keyof typeof PermissionEffect];
