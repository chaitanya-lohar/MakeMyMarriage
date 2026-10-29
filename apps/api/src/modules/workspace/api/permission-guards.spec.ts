import type { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { AppException } from '../../../common/errors/app.exception.js';
import type { AuditService } from '../../audit/index.js';
import type { MembershipsService } from '../application/services/memberships.service.js';
import { PermissionService } from '../application/services/permission.service.js';
import { MemberType, MembershipRole, MembershipStatus } from '../domain/enums/membership.js';
import { PermissionAction, PermissionModule } from '../domain/enums/permission.js';
import type { Membership } from '../domain/types/membership.js';
import { RequirePermission } from './permission.decorators.js';
import { PermissionGuard } from './permission.guard.js';
import { WeddingAccessGuard, type WeddingRequest } from './wedding-access.guard.js';

const WEDDING_ID = '665f1c2e8a1b2c3d4e5f6a7b';

class ExampleController {
  @RequirePermission(PermissionModule.Expenses, PermissionAction.Delete)
  remove(): void {}

  @RequirePermission(PermissionModule.Invitations, PermissionAction.Send)
  sendLink(): void {}

  undeclared(): void {}
}

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: '665f1c2e8a1b2c3d4e5f6a70',
    weddingId: WEDDING_ID,
    userId: '665f1c2e8a1b2c3d4e5f6a71',
    memberType: MemberType.Member,
    role: MembershipRole.Organizer,
    status: MembershipStatus.Active,
    permissionOverrides: [],
    ...overrides,
  };
}

function contextFor(request: Partial<WeddingRequest>, handler: () => void): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => ExampleController,
  } as unknown as ExecutionContext;
}

function accessGuard(found: Membership | null) {
  const findActive = vi.fn().mockResolvedValue(found);
  const guard = new WeddingAccessGuard(
    { findActive } as unknown as MembershipsService,
    new PermissionService(),
  );
  return { guard, findActive };
}

async function rejection(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
  } catch (error) {
    return error as AppException;
  }
  throw new Error('expected a rejection');
}

const signedIn = () => ({
  auth: { userId: '665f1c2e8a1b2c3d4e5f6a71', sessionId: 's' },
  params: { weddingId: WEDDING_ID },
});

describe('WeddingAccessGuard', () => {
  it('attaches the membership and its effective permissions', async () => {
    const { guard } = accessGuard(membership());
    const request: Partial<WeddingRequest> = signedIn();
    await expect(guard.canActivate(contextFor(request, () => {}))).resolves.toBe(true);
    expect(request.membership?.role).toBe(MembershipRole.Organizer);
    expect(request.permissions?.has(PermissionModule.Expenses, PermissionAction.View)).toBe(true);
    expect(request.permissions?.has(PermissionModule.Expenses, PermissionAction.Edit)).toBe(false);
  });

  it('answers 404 WEDDING_NOT_FOUND without an active membership', async () => {
    const { guard } = accessGuard(null);
    const error = await rejection(guard.canActivate(contextFor(signedIn(), () => {})));
    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('looks the membership up only once when declared twice', async () => {
    const { guard, findActive } = accessGuard(membership());
    const request: Partial<WeddingRequest> = signedIn();
    await guard.canActivate(contextFor(request, () => {}));
    await guard.canActivate(contextFor(request, () => {}));
    expect(findActive).toHaveBeenCalledTimes(1);
  });
});

describe('PermissionGuard', () => {
  function permissionGuard() {
    const record = vi.fn(() => Promise.resolve());
    const guard = new PermissionGuard(new Reflector(), { record } as unknown as AuditService);
    return { guard, record };
  }
  // Read handlers through their descriptors: they are passed around as Nest handlers, never called.
  const handler = (name: 'remove' | 'undeclared' | 'sendLink') =>
    Object.getOwnPropertyDescriptor(ExampleController.prototype, name)?.value as () => void;

  async function admitted(member: Membership): Promise<WeddingRequest> {
    const request: Partial<WeddingRequest> = { ...signedIn(), method: 'GET', path: '/x' };
    await accessGuard(member).guard.canActivate(contextFor(request, () => {}));
    return request as WeddingRequest;
  }

  it('admits a member holding the declared permission', async () => {
    const { guard } = permissionGuard();
    const request = await admitted(membership({ role: MembershipRole.Admin }));
    await expect(guard.canActivate(contextFor(request, handler('remove')))).resolves.toBe(true);
  });

  it('admits an owner', async () => {
    const { guard } = permissionGuard();
    const request = await admitted(
      membership({ memberType: MemberType.Owner, role: MembershipRole.Owner, ownerSeat: 1 }),
    );
    await expect(guard.canActivate(contextFor(request, handler('remove')))).resolves.toBe(true);
  });

  it('refuses an active member without it with 403 PERMISSION_DENIED', async () => {
    const { guard, record } = permissionGuard();
    const request = await admitted(membership({ role: MembershipRole.Organizer }));
    const error = await rejection(guard.canActivate(contextFor(request, handler('remove'))));
    expect(error.getStatus()).toBe(403);
    expect(error.code).toBe('PERMISSION_DENIED');
    // An ordinary action: not audited.
    expect(record).not.toHaveBeenCalled();
  });

  it('audits a refused management action (Database Design §22)', async () => {
    const { guard, record } = permissionGuard();
    const request = await admitted(membership({ role: MembershipRole.Admin }));
    const error = await rejection(guard.canActivate(contextFor(request, handler('sendLink'))));
    expect(error.code).toBe('PERMISSION_DENIED');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PERMISSION_DENIED',
        weddingId: WEDDING_ID,
        metadata: expect.objectContaining({ module: 'INVITATIONS', action: 'SEND' }),
      }),
    );
  });

  it('lets routes without a declared permission through (the contract test covers them)', async () => {
    const { guard } = permissionGuard();
    const request = await admitted(membership({ role: MembershipRole.Viewer }));
    await expect(guard.canActivate(contextFor(request, handler('undeclared')))).resolves.toBe(true);
  });

  it('fails loudly when WeddingAccessGuard has not run', async () => {
    const { guard } = permissionGuard();
    await expect(guard.canActivate(contextFor(signedIn(), handler('remove')))).rejects.toThrow(
      /before WeddingAccessGuard/,
    );
  });

  it('is applied by @RequirePermission after WeddingAccessGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler('remove')) as unknown[];
    expect(guards).toEqual([WeddingAccessGuard, PermissionGuard]);
  });
});
