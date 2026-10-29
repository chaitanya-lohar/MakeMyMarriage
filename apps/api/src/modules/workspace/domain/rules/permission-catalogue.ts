import { MembershipRole } from '../enums/membership.js';
import { PermissionAction, PermissionModule } from '../enums/permission.js';

/**
 * The Phase 10 permission catalogue (Database Design §8.1–§8.3, decision 0034). Roles and
 * their defaults are application constants; only a membership's overrides are stored.
 */

const { View, Create, Edit, Delete } = PermissionAction;
const ORDINARY = [View, Create, Edit, Delete] as const;

/**
 * Every action of each module (§8.1): the ordinary actions, then its management actions.
 * `MEMBERS` has `VIEW` and its four management actions; `AUDIT` has `VIEW` only.
 */
export const MODULE_ACTIONS: Readonly<Record<PermissionModule, readonly PermissionAction[]>> = {
  WEDDING_SETTINGS: ORDINARY,
  EVENTS: ORDINARY,
  GUESTS: ORDINARY,
  INVITATIONS: [...ORDINARY, PermissionAction.Send, PermissionAction.Manage],
  TASKS: ORDINARY,
  EXPENSES: ORDINARY,
  VENDORS: ORDINARY,
  WEBSITE: [...ORDINARY, PermissionAction.Configure, PermissionAction.Publish],
  GALLERY: ORDINARY,
  MEMORY_QR: [...ORDINARY, PermissionAction.Regenerate],
  LIVE_STREAM: ORDINARY,
  REPORTS: [...ORDINARY, PermissionAction.Export],
  MEMBERS: [
    View,
    PermissionAction.Invite,
    PermissionAction.ChangeRole,
    PermissionAction.EditPermissions,
    PermissionAction.Remove,
  ],
  AUDIT: [View],
  PARTNER_SHARING: ORDINARY,
};

/** Modules in catalogue order. */
export const PERMISSION_MODULES = Object.keys(MODULE_ACTIONS) as PermissionModule[];

/** Whether `action` is one of `module`'s actions. */
export function isModuleAction(module: string, action: string): boolean {
  return (
    Object.hasOwn(MODULE_ACTIONS, module) &&
    MODULE_ACTIONS[module as PermissionModule].includes(action as PermissionAction)
  );
}

/** Whether `action` is a management action, which no ordinary access level implies. */
export function isManagementAction(action: PermissionAction): boolean {
  return !(ORDINARY as readonly PermissionAction[]).includes(action);
}

/**
 * The §8.2 access levels. Full — every ordinary and management action of the module
 * (owners only). Manage — VIEW, CREATE, EDIT, DELETE. Edit — VIEW, CREATE, EDIT.
 * View — VIEW. Custom and No — nothing by default; Custom is granted by overrides.
 */
export const AccessLevel = {
  Full: 'FULL',
  Manage: 'MANAGE',
  Edit: 'EDIT',
  View: 'VIEW',
  Custom: 'CUSTOM',
  No: 'NO',
} as const;
export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel];

const ACTIONS_OF_LEVEL: Record<AccessLevel, readonly PermissionAction[] | 'ALL'> = {
  FULL: 'ALL',
  MANAGE: ORDINARY,
  EDIT: [View, Create, Edit],
  VIEW: [View],
  CUSTOM: [],
  NO: [],
};

const { Full: F, Manage: M, Edit: E, View: V, Custom: C, No: N } = AccessLevel;

/** The default role matrix, exactly as Database Design §8.2 (PRD v1.2 §24). */
export const DEFAULT_ROLE_MATRIX: Readonly<
  Record<PermissionModule, Readonly<Record<MembershipRole, AccessLevel>>>
> = {
  //                 Owner      Admin      Organizer      Editor     Viewer
  WEDDING_SETTINGS: { OWNER: F, ADMIN: C, ORGANIZER: N, EDITOR: N, VIEWER: N },
  EVENTS: { OWNER: F, ADMIN: M, ORGANIZER: M, EDITOR: E, VIEWER: V },
  GUESTS: { OWNER: F, ADMIN: M, ORGANIZER: M, EDITOR: E, VIEWER: V },
  INVITATIONS: { OWNER: F, ADMIN: M, ORGANIZER: M, EDITOR: E, VIEWER: V },
  TASKS: { OWNER: F, ADMIN: M, ORGANIZER: M, EDITOR: E, VIEWER: V },
  EXPENSES: { OWNER: F, ADMIN: M, ORGANIZER: V, EDITOR: E, VIEWER: V },
  VENDORS: { OWNER: F, ADMIN: M, ORGANIZER: M, EDITOR: E, VIEWER: V },
  WEBSITE: { OWNER: F, ADMIN: C, ORGANIZER: N, EDITOR: N, VIEWER: N },
  GALLERY: { OWNER: F, ADMIN: M, ORGANIZER: C, EDITOR: C, VIEWER: V },
  MEMORY_QR: { OWNER: F, ADMIN: M, ORGANIZER: N, EDITOR: N, VIEWER: N },
  LIVE_STREAM: { OWNER: F, ADMIN: M, ORGANIZER: C, EDITOR: C, VIEWER: V },
  REPORTS: { OWNER: F, ADMIN: C, ORGANIZER: C, EDITOR: N, VIEWER: N },
  MEMBERS: { OWNER: F, ADMIN: C, ORGANIZER: N, EDITOR: N, VIEWER: N },
  AUDIT: { OWNER: F, ADMIN: C, ORGANIZER: N, EDITOR: N, VIEWER: N },
  PARTNER_SHARING: { OWNER: F, ADMIN: N, ORGANIZER: N, EDITOR: N, VIEWER: N },
};

/** The actions a role holds on a module by default (§8.2), before overrides. */
export function defaultActions(
  role: MembershipRole,
  module: PermissionModule,
): readonly PermissionAction[] {
  const level = ACTIONS_OF_LEVEL[DEFAULT_ROLE_MATRIX[module][role]];
  const actions = MODULE_ACTIONS[module];
  return level === 'ALL' ? actions : actions.filter((action) => level.includes(action));
}

/**
 * Owner-only by default but grantable to any non-owner by an `ALLOW` override (§8.2, §8.3,
 * P10-6). They follow from the matrix — Manage and Edit never include management actions —
 * and are listed for clarity.
 */
export const OWNER_ONLY_BY_DEFAULT: readonly (readonly [PermissionModule, PermissionAction])[] = [
  [PermissionModule.Invitations, PermissionAction.Send],
  [PermissionModule.Invitations, PermissionAction.Manage],
  [PermissionModule.MemoryQr, PermissionAction.Regenerate],
];

/**
 * Protected actions (§8.3): owner-only, never granted by a role default or an override,
 * and never removed from an owner. Only partner connection, disconnection and sharing has
 * its own permission key, `PARTNER_SHARING`; the evaluator strips every action of that
 * module from non-owners.
 */
export const PROTECTED_MODULES: readonly PermissionModule[] = [PermissionModule.PartnerSharing];

/**
 * The other protected actions of §8.3 are operations with no `(module, action)` key; the
 * routes and services that perform them check for an owner (System Design §7.5, §7.8).
 */
export const ProtectedOperation = {
  /** Ownership-seat transfer (§7.6, P10-5). */
  TransferOwnership: 'TRANSFER_OWNERSHIP',
  /** Archive or delete the wedding. */
  ArchiveWedding: 'ARCHIVE_WEDDING',
  /** Partner connection, disconnection and sharing (`PARTNER_SHARING`; A4/A5, 0011). */
  PartnerSharing: 'PARTNER_SHARING',
  /** Any change to an `OWNER` membership. */
  ChangeOwnerMembership: 'CHANGE_OWNER_MEMBERSHIP',
  /** Assigning the `ADMIN` role (P10-4). */
  AssignAdminRole: 'ASSIGN_ADMIN_ROLE',
  /** Managing an `ADMIN` membership (P10-4). */
  ManageAdminMembership: 'MANAGE_ADMIN_MEMBERSHIP',
} as const;
export type ProtectedOperation = (typeof ProtectedOperation)[keyof typeof ProtectedOperation];

/** Whether every action of `module` is protected (§8.3). */
export function isProtectedModule(module: PermissionModule): boolean {
  return PROTECTED_MODULES.includes(module);
}
