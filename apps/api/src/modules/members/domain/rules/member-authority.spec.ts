import { describe, expect, it } from 'vitest';
import {
  evaluatePermissions,
  MemberType,
  MembershipRole,
  MembershipStatus,
  type Membership,
  type PermissionOverride,
} from '../../../workspace/index.js';
import {
  MAX_OVERRIDES,
  MemberRefusal,
  overrideProblems,
  overridesAdded,
  refuseMemberChange,
  storedOverrides,
  withinGrantCeiling,
} from './member-authority.js';

let counter = 0;
function membership(role: MembershipRole, overrides: PermissionOverride[] = []): Membership {
  const owner = role === MembershipRole.Owner;
  return {
    id: `m${++counter}`,
    weddingId: 'w',
    userId: `u${counter}`,
    memberType: owner ? MemberType.Owner : MemberType.Member,
    role,
    status: MembershipStatus.Active,
    permissionOverrides: overrides,
    ...(owner && { ownerSeat: 1 as const }),
  };
}
const caller = (target: Membership) => ({
  membership: target,
  permissions: evaluatePermissions(target),
});
const allow = (module: string, action: string) =>
  ({ module, action, effect: 'ALLOW' }) as PermissionOverride;
const deny = (module: string, action: string) =>
  ({ module, action, effect: 'DENY' }) as PermissionOverride;

describe('refuseMemberChange (Database Design §8.3, P10-4)', () => {
  const owner = caller(membership(MembershipRole.Owner));
  const admin = caller(
    membership(MembershipRole.Admin, [
      allow('MEMBERS', 'VIEW'),
      allow('MEMBERS', 'CHANGE_ROLE'),
      allow('MEMBERS', 'EDIT_PERMISSIONS'),
    ]),
  );

  it('never lets anyone change an owner', () => {
    expect(refuseMemberChange(owner, membership(MembershipRole.Owner))).toBe(
      MemberRefusal.OwnerMembershipProtected,
    );
  });

  it('never lets a member change themselves', () => {
    expect(refuseMemberChange(admin, admin.membership, { role: MembershipRole.Viewer })).toBe(
      MemberRefusal.SelfModificationNotAllowed,
    );
  });

  it('lets an owner manage admins and assign ADMIN', () => {
    expect(refuseMemberChange(owner, membership(MembershipRole.Admin))).toBeNull();
    expect(
      refuseMemberChange(owner, membership(MembershipRole.Viewer), { role: MembershipRole.Admin }),
    ).toBeNull();
  });

  it('keeps an admin away from other admins and from the ADMIN role', () => {
    expect(refuseMemberChange(admin, membership(MembershipRole.Admin))).toBe(
      MemberRefusal.AdminMembershipOwnerOnly,
    );
    expect(
      refuseMemberChange(admin, membership(MembershipRole.Editor), { role: MembershipRole.Admin }),
    ).toBe(MemberRefusal.AdminRoleOwnerOnly);
  });

  it('caps what a non-owner may allow at what they hold, but lets them deny', () => {
    const target = membership(MembershipRole.Viewer);
    expect(
      refuseMemberChange(admin, target, { permissionOverrides: [allow('EVENTS', 'DELETE')] }),
    ).toBeNull();
    expect(
      refuseMemberChange(admin, target, { permissionOverrides: [allow('INVITATIONS', 'SEND')] }),
    ).toBe(MemberRefusal.GrantExceedsCaller);
    expect(
      refuseMemberChange(admin, target, { permissionOverrides: [deny('INVITATIONS', 'SEND')] }),
    ).toBeNull();
  });
});

describe('overrideProblems', () => {
  it('accepts catalogue permissions once each', () => {
    expect(overrideProblems([allow('EVENTS', 'DELETE'), deny('TASKS', 'CREATE')])).toBeNull();
  });

  it('refuses unknown, protected and repeated entries, and too many', () => {
    expect(overrideProblems([allow('EVENTS', 'PUBLISH')])).toHaveLength(1);
    expect(overrideProblems([allow('PARTNER_SHARING', 'VIEW')])).toHaveLength(1);
    expect(overrideProblems([allow('EVENTS', 'DELETE'), deny('EVENTS', 'DELETE')])).toHaveLength(1);
    const many = Array.from({ length: MAX_OVERRIDES + 1 }, () => allow('EVENTS', 'VIEW'));
    expect(overrideProblems(many)?.[0]).toMatch(/At most 64/);
  });
});

describe('storedOverrides', () => {
  it('drops entries equal to the role default (Database Design §8.4)', () => {
    expect(
      storedOverrides(MembershipRole.Organizer, [
        allow('EVENTS', 'VIEW'),
        allow('EXPENSES', 'CREATE'),
        deny('EVENTS', 'DELETE'),
        deny('WEBSITE', 'VIEW'),
      ]),
    ).toEqual([allow('EXPENSES', 'CREATE'), deny('EVENTS', 'DELETE')]);
  });
});

describe('overridesAdded', () => {
  it('lists the new entries only', () => {
    expect(
      overridesAdded(
        [allow('EVENTS', 'DELETE')],
        [allow('EVENTS', 'DELETE'), deny('TASKS', 'EDIT')],
      ),
    ).toEqual([deny('TASKS', 'EDIT')]);
  });
});

describe('withinGrantCeiling (P10-4)', () => {
  const editor = caller(
    membership(MembershipRole.Editor, [{ module: 'MEMBERS', action: 'VIEW', effect: 'ALLOW' }]),
  );
  const ownerSet = [deny('EXPENSES', 'DELETE'), allow('INVITATIONS', 'SEND')];

  it('keeps entries on actions the caller does not hold, even when left out', () => {
    expect(withinGrantCeiling(editor, ownerSet, [])).toEqual({
      overrides: ownerSet,
      authored: [],
      exceeds: false,
    });
  });

  it('accepts those entries resubmitted unchanged, and changes to held actions', () => {
    const result = withinGrantCeiling(editor, ownerSet, [...ownerSet, deny('EVENTS', 'EDIT')]);
    expect(result.exceeds).toBe(false);
    expect(result.overrides).toEqual([deny('EVENTS', 'EDIT'), ...ownerSet]);
  });

  it('refuses changing an entry on an action the caller does not hold', () => {
    expect(withinGrantCeiling(editor, ownerSet, [allow('EXPENSES', 'DELETE')]).exceeds).toBe(true);
  });

  it('does not limit owners', () => {
    expect(withinGrantCeiling(caller(membership(MembershipRole.Owner)), ownerSet, [])).toEqual({
      overrides: [],
      authored: [],
      exceeds: false,
    });
  });
});
