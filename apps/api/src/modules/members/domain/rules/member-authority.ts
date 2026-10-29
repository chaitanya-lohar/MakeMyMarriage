import {
  defaultActions,
  isModuleAction,
  isProtectedModule,
  MemberType,
  MembershipRole,
  PermissionEffect,
  type EffectivePermissions,
  type Membership,
  type PermissionOverride,
} from '../../../workspace/index.js';

/** At most one entry per `(module, action)` and at most 64 entries (Database Design §7.2). */
export const MAX_OVERRIDES = 64;

/** Roles an organizer invitation or a role change may give (API Design §7.1). */
export const ASSIGNABLE_ROLES = [
  MembershipRole.Admin,
  MembershipRole.Organizer,
  MembershipRole.Editor,
  MembershipRole.Viewer,
] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** The `details.reason` of a refused membership change (API Design §7.1). */
export const MemberRefusal = {
  OwnerMembershipProtected: 'OWNER_MEMBERSHIP_PROTECTED',
  SelfModificationNotAllowed: 'SELF_MODIFICATION_NOT_ALLOWED',
  AdminRoleOwnerOnly: 'ADMIN_ROLE_OWNER_ONLY',
  AdminMembershipOwnerOnly: 'ADMIN_MEMBERSHIP_OWNER_ONLY',
  GrantExceedsCaller: 'GRANT_EXCEEDS_CALLER',
} as const;
export type MemberRefusal = (typeof MemberRefusal)[keyof typeof MemberRefusal];

/** Who is changing a membership. */
export interface MemberChangeCaller {
  membership: Membership;
  permissions: EffectivePermissions;
}

/** A requested change to a membership; absent fields are not changed. */
export interface MemberChange {
  role?: AssignableRole;
  permissionOverrides?: readonly PermissionOverride[];
}

/**
 * Why `caller` may not make `change` to `target`, or null (Database Design §8.3, P10-4).
 * Owners may change any non-owner membership, `ADMIN` included; nobody changes an owner or
 * themselves; a non-owner may not assign `ADMIN`, touch an `ADMIN`, or `ALLOW` an action they
 * do not hold. The caller's `MEMBERS` permissions are checked separately.
 */
export function refuseMemberChange(
  caller: MemberChangeCaller,
  target: Membership,
  change: MemberChange = {},
): MemberRefusal | null {
  if (target.memberType === MemberType.Owner) return MemberRefusal.OwnerMembershipProtected;
  if (target.id === caller.membership.id) return MemberRefusal.SelfModificationNotAllowed;
  if (caller.permissions.isOwner) return null;

  if (target.role === MembershipRole.Admin) return MemberRefusal.AdminMembershipOwnerOnly;
  if (change.role === MembershipRole.Admin) return MemberRefusal.AdminRoleOwnerOnly;
  const exceeds = (change.permissionOverrides ?? []).some(
    (override) =>
      override.effect === PermissionEffect.Allow &&
      !caller.permissions.has(override.module, override.action),
  );
  return exceeds ? MemberRefusal.GrantExceedsCaller : null;
}

/**
 * Applies a non-owner's new override list within their grant ceiling (P10-4): they change
 * entries only for actions they hold. Entries on actions they do not hold stay exactly as
 * stored, so they can neither drop an owner's DENY nor add or alter what they cannot grant;
 * submitting such an entry unchanged is fine, changing one is `exceeds`. `authored` is the
 * part the caller decides. Owners are not limited.
 */
export function withinGrantCeiling(
  caller: MemberChangeCaller,
  stored: readonly PermissionOverride[],
  submitted: readonly PermissionOverride[],
): { overrides: PermissionOverride[]; authored: PermissionOverride[]; exceeds: boolean } {
  if (caller.permissions.isOwner) {
    return { overrides: [...submitted], authored: [...submitted], exceeds: false };
  }
  const held = (o: PermissionOverride) => caller.permissions.has(o.module, o.action);
  const kept = stored.filter((o) => !held(o));
  const same = (a: PermissionOverride, b: PermissionOverride) =>
    a.module === b.module && a.action === b.action && a.effect === b.effect;
  const exceeds = submitted.filter((o) => !held(o)).some((o) => !kept.some((k) => same(k, o)));
  const authored = submitted.filter(held);
  return { overrides: [...authored, ...kept], authored, exceeds };
}

/** The field messages of an invalid override list, or null when it is valid (API Design §7.1). */
export function overrideProblems(overrides: readonly PermissionOverride[]): string[] | null {
  const problems: string[] = [];
  if (overrides.length > MAX_OVERRIDES) {
    problems.push(`At most ${MAX_OVERRIDES} custom permissions are allowed.`);
  }
  const seen = new Set<string>();
  for (const { module, action } of overrides) {
    const key = `${module}:${action}`;
    if (!isModuleAction(module, action)) problems.push(`${key} is not a permission.`);
    else if (isProtectedModule(module)) problems.push(`${key} can never be granted.`);
    if (seen.has(key)) problems.push(`${key} appears more than once.`);
    seen.add(key);
  }
  return problems.length > 0 ? problems : null;
}

/**
 * The overrides worth storing for `role`: those that differ from its defaults (Database
 * Design §8.4 — an override equal to the default stores nothing), in catalogue order.
 */
export function storedOverrides(
  role: MembershipRole,
  overrides: readonly PermissionOverride[],
): PermissionOverride[] {
  return overrides.filter((override) => {
    const byDefault = defaultActions(role, override.module).includes(override.action);
    return override.effect === PermissionEffect.Allow ? !byDefault : byDefault;
  });
}

/** The entries in `after` and not in `before` — for audit metadata. */
export function overridesAdded(
  before: readonly PermissionOverride[],
  after: readonly PermissionOverride[],
): PermissionOverride[] {
  const key = (o: PermissionOverride) => `${o.module}:${o.action}:${o.effect}`;
  const old = new Set(before.map(key));
  return after.filter((override) => !old.has(key(override)));
}
