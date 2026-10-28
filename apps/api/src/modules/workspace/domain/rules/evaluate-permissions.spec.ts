import { describe, expect, it } from 'vitest';
import { MemberType, MembershipRole, MembershipStatus } from '../enums/membership.js';
import { PermissionAction, PermissionEffect, PermissionModule } from '../enums/permission.js';
import type { PermissionOverride } from '../types/membership.js';
import { evaluatePermissions } from './evaluate-permissions.js';
import { MODULE_ACTIONS, PERMISSION_MODULES } from './permission-catalogue.js';

const { View, Create, Edit, Delete } = PermissionAction;
const M = PermissionModule;
const A = PermissionAction;

const MANAGE = [View, Create, Edit, Delete];
const EDIT = [View, Create, Edit];
const VIEW = [View];
const NONE: PermissionAction[] = [];

type NonOwnerRole = Exclude<MembershipRole, 'OWNER'>;

/**
 * Database Design §8.2, transcribed independently of the catalogue: the actions each role
 * holds by default. Custom and No both hold nothing.
 */
const EXPECTED: Record<PermissionModule, Record<NonOwnerRole, PermissionAction[]>> = {
  WEDDING_SETTINGS: { ADMIN: NONE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: NONE },
  EVENTS: { ADMIN: MANAGE, ORGANIZER: MANAGE, EDITOR: EDIT, VIEWER: VIEW },
  GUESTS: { ADMIN: MANAGE, ORGANIZER: MANAGE, EDITOR: EDIT, VIEWER: VIEW },
  INVITATIONS: { ADMIN: MANAGE, ORGANIZER: MANAGE, EDITOR: EDIT, VIEWER: VIEW },
  TASKS: { ADMIN: MANAGE, ORGANIZER: MANAGE, EDITOR: EDIT, VIEWER: VIEW },
  EXPENSES: { ADMIN: MANAGE, ORGANIZER: VIEW, EDITOR: EDIT, VIEWER: VIEW },
  VENDORS: { ADMIN: MANAGE, ORGANIZER: MANAGE, EDITOR: EDIT, VIEWER: VIEW },
  WEBSITE: { ADMIN: NONE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: NONE },
  GALLERY: { ADMIN: MANAGE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: VIEW },
  MEMORY_QR: { ADMIN: MANAGE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: NONE },
  LIVE_STREAM: { ADMIN: MANAGE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: VIEW },
  REPORTS: { ADMIN: NONE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: NONE },
  MEMBERS: { ADMIN: NONE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: NONE },
  AUDIT: { ADMIN: NONE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: NONE },
  PARTNER_SHARING: { ADMIN: NONE, ORGANIZER: NONE, EDITOR: NONE, VIEWER: NONE },
};

const NON_OWNER_ROLES: NonOwnerRole[] = ['ADMIN', 'ORGANIZER', 'EDITOR', 'VIEWER'];

function member(role: NonOwnerRole, permissionOverrides: PermissionOverride[] = []) {
  return {
    memberType: MemberType.Member,
    role,
    status: MembershipStatus.Active,
    permissionOverrides,
  };
}

const owner = (permissionOverrides: PermissionOverride[] = []) => ({
  memberType: MemberType.Owner,
  role: MembershipRole.Owner,
  status: MembershipStatus.Active,
  permissionOverrides,
});

const allow = (module: PermissionModule, action: PermissionAction): PermissionOverride => ({
  module,
  action,
  effect: PermissionEffect.Allow,
});
const deny = (module: PermissionModule, action: PermissionAction): PermissionOverride => ({
  module,
  action,
  effect: PermissionEffect.Deny,
});

describe('evaluatePermissions — role defaults (Database Design §8.2)', () => {
  it('gives an owner every action of every module, protected actions included', () => {
    const permissions = evaluatePermissions(owner());
    expect(permissions.isOwner).toBe(true);
    for (const module of PERMISSION_MODULES) {
      for (const action of MODULE_ACTIONS[module]) {
        expect(permissions.has(module, action), `${module}:${action}`).toBe(true);
      }
    }
    expect(permissions.toRecord()).toEqual(
      Object.fromEntries(PERMISSION_MODULES.map((module) => [module, [...MODULE_ACTIONS[module]]])),
    );
  });

  for (const role of NON_OWNER_ROLES) {
    it(`gives ${role} exactly the matrix defaults, every module and action`, () => {
      const permissions = evaluatePermissions(member(role));
      expect(permissions.isOwner).toBe(false);
      for (const module of PERMISSION_MODULES) {
        for (const action of MODULE_ACTIONS[module]) {
          expect(permissions.has(module, action), `${role} ${module}:${action}`).toBe(
            EXPECTED[module][role].includes(action),
          );
        }
      }
    });
  }

  it('never implies a management action from Manage or Edit', () => {
    for (const role of NON_OWNER_ROLES) {
      const permissions = evaluatePermissions(member(role));
      expect(permissions.has(M.Invitations, A.Send)).toBe(false);
      expect(permissions.has(M.Invitations, A.Manage)).toBe(false);
      expect(permissions.has(M.MemoryQr, A.Regenerate)).toBe(false);
      expect(permissions.has(M.Website, A.Publish)).toBe(false);
      expect(permissions.has(M.Reports, A.Export)).toBe(false);
      expect(permissions.has(M.Members, A.Invite)).toBe(false);
    }
  });

  it('lists only modules that grant something, in catalogue order', () => {
    expect(evaluatePermissions(member('VIEWER')).toRecord()).toEqual({
      EVENTS: [View],
      GUESTS: [View],
      INVITATIONS: [View],
      TASKS: [View],
      EXPENSES: [View],
      VENDORS: [View],
      GALLERY: [View],
      LIVE_STREAM: [View],
    });
  });
});

describe('evaluatePermissions — membership status', () => {
  for (const status of [MembershipStatus.Revoked, MembershipStatus.Invited]) {
    it(`gives a ${status} membership nothing, owners included`, () => {
      expect(evaluatePermissions({ ...owner(), status }).toRecord()).toEqual({});
      expect(evaluatePermissions({ ...owner(), status }).isOwner).toBe(false);
      expect(evaluatePermissions({ ...member('ADMIN'), status }).toRecord()).toEqual({});
    });
  }

  it('gives a row whose memberType and role disagree nothing', () => {
    expect(
      evaluatePermissions({ ...member('ADMIN'), role: MembershipRole.Owner }).toRecord(),
    ).toEqual({});
    expect(evaluatePermissions({ ...owner(), role: MembershipRole.Admin }).toRecord()).toEqual({});
  });
});

describe('evaluatePermissions — overrides (Database Design §8.4)', () => {
  it('ignores overrides on an owner', () => {
    const permissions = evaluatePermissions(
      owner([deny(M.Events, View), deny(M.Expenses, Delete)]),
    );
    expect(permissions.has(M.Events, View)).toBe(true);
    expect(permissions.has(M.Expenses, Delete)).toBe(true);
  });

  it('adds an ALLOW to the role defaults', () => {
    const permissions = evaluatePermissions(member('EDITOR', [allow(M.Events, Delete)]));
    expect(permissions.has(M.Events, Delete)).toBe(true);
    expect(permissions.has(M.Guests, Delete)).toBe(false);
  });

  it('grants a Custom module only through ALLOW, which needs VIEW too', () => {
    expect(evaluatePermissions(member('ADMIN')).has(M.Members, A.Invite)).toBe(false);
    expect(
      evaluatePermissions(member('ADMIN', [allow(M.Members, A.Invite)])).has(M.Members, A.Invite),
    ).toBe(false);
    const permissions = evaluatePermissions(
      member('ADMIN', [allow(M.Members, View), allow(M.Members, A.Invite)]),
    );
    expect(permissions.has(M.Members, View)).toBe(true);
    expect(permissions.has(M.Members, A.Invite)).toBe(true);
  });

  it('removes a default with DENY', () => {
    const permissions = evaluatePermissions(member('ORGANIZER', [deny(M.Tasks, Delete)]));
    expect(permissions.has(M.Tasks, Delete)).toBe(false);
    expect(permissions.has(M.Tasks, Edit)).toBe(true);
  });

  it('lets DENY win over ALLOW for the same module and action, in either order', () => {
    for (const overrides of [
      [allow(M.Events, Delete), deny(M.Events, Delete)],
      [deny(M.Events, Delete), allow(M.Events, Delete)],
    ]) {
      expect(evaluatePermissions(member('EDITOR', overrides)).has(M.Events, Delete)).toBe(false);
    }
  });

  it('closes the whole module on DENY of VIEW, whatever else is allowed', () => {
    const permissions = evaluatePermissions(
      member('ADMIN', [deny(M.Expenses, View), allow(M.Expenses, Create)]),
    );
    for (const action of MODULE_ACTIONS.EXPENSES) {
      expect(permissions.has(M.Expenses, action)).toBe(false);
    }
    expect(permissions.toRecord().EXPENSES).toBeUndefined();
    expect(permissions.has(M.Events, View)).toBe(true);
  });

  it('drops modifying and management actions without VIEW on their module', () => {
    const permissions = evaluatePermissions(
      member('EDITOR', [allow(M.Website, A.Publish), allow(M.Reports, A.Export)]),
    );
    expect(permissions.has(M.Website, A.Publish)).toBe(false);
    expect(permissions.has(M.Reports, A.Export)).toBe(false);
  });

  it('grants the owner-only-by-default actions to any role by ALLOW (P10-6)', () => {
    for (const role of NON_OWNER_ROLES) {
      const permissions = evaluatePermissions(
        member(role, [
          allow(M.Invitations, A.Send),
          allow(M.Invitations, A.Manage),
          allow(M.MemoryQr, View),
          allow(M.MemoryQr, A.Regenerate),
        ]),
      );
      expect(permissions.has(M.Invitations, A.Send), role).toBe(true);
      expect(permissions.has(M.Invitations, A.Manage), role).toBe(true);
      expect(permissions.has(M.MemoryQr, A.Regenerate), role).toBe(true);
    }
  });

  it('never grants a protected action by override', () => {
    const permissions = evaluatePermissions(
      member(
        'ADMIN',
        MODULE_ACTIONS.PARTNER_SHARING.map((action) => allow(M.PartnerSharing, action)),
      ),
    );
    for (const action of MODULE_ACTIONS.PARTNER_SHARING) {
      expect(permissions.has(M.PartnerSharing, action)).toBe(false);
    }
  });

  it('ignores overrides naming an unknown module or an action the module lacks', () => {
    const permissions = evaluatePermissions(
      member('VIEWER', [
        { module: 'UNKNOWN' as PermissionModule, action: View, effect: PermissionEffect.Allow },
        allow(M.Audit, A.Export),
        allow(M.Events, A.Publish),
      ]),
    );
    expect(permissions.toRecord()).toEqual(evaluatePermissions(member('VIEWER')).toRecord());
  });
});
