import type { components } from '@makemymarriage/api-client';

export type ApiMember = components['schemas']['MemberDto'];
export type ApiMemberPermissions = components['schemas']['MemberPermissionsDto'];
export type ApiInvitation = components['schemas']['MemberInvitationDto'];
export type ApiTransfer = components['schemas']['OwnershipTransferDto'];
export type ApiAuditEntry = components['schemas']['AuditLogDto'];
export type ApiOverride = components['schemas']['PermissionOverrideDto'];

export const ASSIGNABLE_ROLES = ['ADMIN', 'ORGANIZER', 'EDITOR', 'VIEWER'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED'];

/**
 * The modules the permissions table shows (Stitch "P10 · M4", Database Design §8.1): the
 * built ones, each with its ordinary actions and its special actions.
 */
export const PERMISSION_ROWS: {
  module: string;
  label: string;
  actions: ('VIEW' | 'CREATE' | 'EDIT' | 'DELETE')[];
  special: { action: string; label: string; ownerOnlyByDefault?: boolean }[];
}[] = [
  { module: 'WEDDING_SETTINGS', label: 'Wedding settings', actions: ['VIEW', 'EDIT'], special: [] },
  { module: 'EVENTS', label: 'Events', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'], special: [] },
  { module: 'GUESTS', label: 'Guests', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'], special: [] },
  {
    module: 'INVITATIONS',
    label: 'Invitations & RSVP',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    special: [
      { action: 'SEND', label: 'Send guest links', ownerOnlyByDefault: true },
      { action: 'MANAGE', label: 'Regenerate or revoke guest links', ownerOnlyByDefault: true },
    ],
  },
  { module: 'TASKS', label: 'Tasks', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'], special: [] },
  {
    module: 'EXPENSES',
    label: 'Expenses',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    special: [],
  },
  {
    module: 'VENDORS',
    label: 'Vendors',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    special: [],
  },
  {
    module: 'MEMBERS',
    label: 'Organizer management',
    actions: ['VIEW'],
    special: [
      { action: 'INVITE', label: 'Invite' },
      { action: 'CHANGE_ROLE', label: 'Change role' },
      { action: 'EDIT_PERMISSIONS', label: 'Edit permissions' },
      { action: 'REMOVE', label: 'Remove' },
    ],
  },
  { module: 'AUDIT', label: 'Audit history', actions: ['VIEW'], special: [] },
];

export const ACTION_LABELS: Record<string, string> = {
  VIEW: 'View',
  CREATE: 'Create',
  EDIT: 'Edit',
  DELETE: 'Delete',
};

/** A cell's chosen setting: the role's default, or an override. */
export type CellChoice = 'DEFAULT' | 'ALLOW' | 'DENY';

const key = (module: string, action: string) => `${module}:${action}`;

/** The override list as a map from "MODULE:ACTION" to ALLOW or DENY. */
export function overrideMap(overrides: ApiOverride[]): Map<string, 'ALLOW' | 'DENY'> {
  return new Map(overrides.map((o) => [key(o.module, o.action), o.effect]));
}

export function choiceOf(
  overrides: Map<string, 'ALLOW' | 'DENY'>,
  module: string,
  action: string,
): CellChoice {
  return overrides.get(key(module, action)) ?? 'DEFAULT';
}

/** The complete override list to save, from the table's choices (API Design §7.1). */
export function overridesFrom(choices: Map<string, 'ALLOW' | 'DENY'>): ApiOverride[] {
  return [...choices].map(([k, effect]) => {
    const [module, action] = k.split(':') as [ApiOverride['module'], ApiOverride['action']];
    return { module, action, effect };
  });
}

export function setChoice(
  choices: Map<string, 'ALLOW' | 'DENY'>,
  module: string,
  action: string,
  choice: CellChoice,
): Map<string, 'ALLOW' | 'DENY'> {
  const next = new Map(choices);
  if (choice === 'DEFAULT') next.delete(key(module, action));
  else next.set(key(module, action), choice);
  return next;
}

/** Whole days from `now` until `expiresAt`, rounded down; 0 means today. */
export function daysUntil(expiresAt: string, now: Date = new Date()): number {
  return Math.floor((new Date(expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "27 Oct 2026" for an instant, in India time (the app's single timezone). */
export function shortDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return `${part('day')} ${MONTHS[part('month') - 1]} ${part('year')}`;
}

/** "27 Oct 2026, 4:12 pm" for an instant, in India time. */
export function dateTime(iso: string): string {
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .toLowerCase();
  return `${shortDate(iso)}, ${time}`;
}

/** "Name (you)"-free display: the member's name, or their email when it is empty. */
export function memberName(member: Pick<ApiMember, 'displayName' | 'email'>): string {
  return member.displayName || member.email || '';
}
