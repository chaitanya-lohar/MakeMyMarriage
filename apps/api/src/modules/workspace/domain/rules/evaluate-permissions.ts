import { MemberType, MembershipRole, MembershipStatus } from '../enums/membership.js';
import { PermissionAction, PermissionEffect, type PermissionModule } from '../enums/permission.js';
import type { Membership } from '../types/membership.js';
import {
  defaultActions,
  isModuleAction,
  isProtectedModule,
  MODULE_ACTIONS,
  PERMISSION_MODULES,
} from './permission-catalogue.js';

/** The effective permissions of one membership: what its member may do in the wedding. */
export class EffectivePermissions {
  constructor(
    readonly isOwner: boolean,
    private readonly granted: ReadonlyMap<PermissionModule, ReadonlySet<PermissionAction>>,
  ) {}

  has(module: PermissionModule, action: PermissionAction): boolean {
    return this.granted.get(module)?.has(action) ?? false;
  }

  /** `{ [module]: action[] }` in catalogue order, without modules that grant nothing. */
  toRecord(): Partial<Record<PermissionModule, PermissionAction[]>> {
    const record: Partial<Record<PermissionModule, PermissionAction[]>> = {};
    for (const module of PERMISSION_MODULES) {
      const actions = MODULE_ACTIONS[module].filter((action) => this.has(module, action));
      if (actions.length > 0) record[module] = actions;
    }
    return record;
  }
}

type Subject = Pick<Membership, 'memberType' | 'role' | 'status' | 'permissionOverrides'>;

/**
 * Evaluates a membership's effective permissions (Database Design §8.4, System Design §7.3):
 *
 * 1. Only an ACTIVE membership holds anything.
 * 2. An OWNER holds every action of every module, protected ones included; overrides are
 *    ignored.
 * 3. Otherwise start from the role defaults (§8.2).
 * 4. ALLOW adds a `(module, action)`, DENY removes it — DENY wins for the same pair — and a
 *    DENY of VIEW removes the whole module.
 * 5. Every other action needs VIEW on the same module.
 * 6. Protected actions (§8.3) are removed.
 *
 * Overrides naming an unknown module or an action the module does not have are ignored.
 */
export function evaluatePermissions(membership: Subject): EffectivePermissions {
  const granted = new Map<PermissionModule, Set<PermissionAction>>();
  const nothing = new EffectivePermissions(false, granted);
  if (membership.status !== MembershipStatus.Active) return nothing;

  const ownerType = membership.memberType === MemberType.Owner;
  const ownerRole = membership.role === MembershipRole.Owner;
  // memberType and role move together (Database Design §7.2); a row where they disagree is
  // inconsistent and holds nothing rather than an owner's or a role's permissions.
  if (ownerType !== ownerRole) return nothing;
  if (ownerType) {
    for (const module of PERMISSION_MODULES) granted.set(module, new Set(MODULE_ACTIONS[module]));
    return new EffectivePermissions(true, granted);
  }

  for (const module of PERMISSION_MODULES) {
    granted.set(module, new Set(defaultActions(membership.role, module)));
  }

  const overrides = membership.permissionOverrides.filter((override) =>
    isModuleAction(override.module, override.action),
  );
  for (const override of overrides) {
    if (override.effect === PermissionEffect.Allow) {
      granted.get(override.module)?.add(override.action);
    }
  }
  for (const override of overrides) {
    if (override.effect !== PermissionEffect.Deny) continue;
    if (override.action === PermissionAction.View) granted.get(override.module)?.clear();
    else granted.get(override.module)?.delete(override.action);
  }

  for (const [module, actions] of granted) {
    if (!actions.has(PermissionAction.View) || isProtectedModule(module)) actions.clear();
  }
  return new EffectivePermissions(false, granted);
}
