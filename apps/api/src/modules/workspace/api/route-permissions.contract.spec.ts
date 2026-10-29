import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isModuleAction } from '../domain/rules/permission-catalogue.js';
import {
  MEMBERSHIP_ONLY,
  REQUIRED_PERMISSION,
  type RequiredPermission,
} from './permission.metadata.js';
import { PermissionGuard } from './permission.guard.js';
import { WeddingAccessGuard } from './wedding-access.guard.js';

const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface RouteInfo {
  /** `METHOD /path`, e.g. `PATCH /weddings/:weddingId/events/:eventId`. */
  key: string;
  controller: string;
  handler: string;
  permission?: RequiredPermission;
  membershipOnly: boolean;
  guards: unknown[];
}

function joinPath(...parts: (string | string[] | undefined)[]): string {
  const segments = parts
    .map((part) => (Array.isArray(part) ? part[0] : part) ?? '')
    .flatMap((part) => part.split('/'))
    .filter(Boolean);
  return `/${segments.join('/')}`;
}

/** Every controller route of every domain module, read from the Nest decorator metadata. */
async function listRoutes(): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];
  for (const moduleName of readdirSync(MODULES_DIR)) {
    const dir = join(MODULES_DIR, moduleName, 'api', 'controllers');
    let files: string[];
    try {
      files = readdirSync(dir).filter((file) => file.endsWith('.controller.ts'));
    } catch {
      continue;
    }
    for (const file of files) {
      const exports = (await import(pathToFileURL(join(dir, file)).href)) as Record<
        string,
        unknown
      >;
      for (const controller of Object.values(exports)) {
        if (typeof controller !== 'function') continue;
        const base = Reflect.getMetadata(PATH_METADATA, controller) as
          string | string[] | undefined;
        if (base === undefined) continue;
        const classGuards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
        const prototype = controller.prototype as Record<string, unknown>;
        for (const name of Object.getOwnPropertyNames(prototype)) {
          const handler = prototype[name];
          if (name === 'constructor' || typeof handler !== 'function') continue;
          const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
          if (method === undefined) continue;
          const path = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
          routes.push({
            key: `${RequestMethod[method]} ${joinPath(base, path)}`,
            controller: controller.name,
            handler: name,
            permission: Reflect.getMetadata(REQUIRED_PERMISSION, handler) as
              RequiredPermission | undefined,
            membershipOnly: Reflect.getMetadata(MEMBERSHIP_ONLY, handler) === true,
            guards: [
              ...classGuards,
              ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[]),
            ],
          });
        }
      }
    }
  }
  return routes.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Route-permission contract (API Design §23 rollout step 2, System Design §7.11): every
 * wedding route declares exactly one `(module, action)` with `@RequirePermission`, apart
 * from the few marked `@MembershipOnly()`, and runs behind WeddingAccessGuard.
 */

/** The only routes that need an active membership and no permission (API Design §23). */
const MEMBERSHIP_ONLY_ROUTES = new Set([
  'GET /weddings',
  'GET /weddings/:weddingId',
  'GET /weddings/:weddingId/dashboard',
  'GET /weddings/:weddingId/members',
  'GET /weddings/:weddingId/members/me/permissions',
  // Ownership-seat transfer: protected, not a module action (API Design §7.1, P10-5). The
  // service lets only an owner offer, the recipient answer and the giver cancel.
  'GET /weddings/:weddingId/ownership-transfers',
  'POST /weddings/:weddingId/ownership-transfers',
  'POST /weddings/:weddingId/ownership-transfers/:transferId/accept',
  'POST /weddings/:weddingId/ownership-transfers/:transferId/decline',
  'POST /weddings/:weddingId/ownership-transfers/:transferId/cancel',
]);

const isWeddingRoute = (route: RouteInfo) => route.key.includes('/:weddingId');
const declarations = (route: RouteInfo) =>
  Number(!!route.permission) + Number(route.membershipOnly);

describe('route-permission contract (API Design §23)', async () => {
  const routes = await listRoutes();
  const weddingRoutes = routes.filter(isWeddingRoute);

  it('finds the controllers', () => {
    expect(weddingRoutes.length).toBeGreaterThan(0);
  });

  it('declares exactly one permission, or membership only, on every wedding route', () => {
    const offending = weddingRoutes
      .filter((route) => declarations(route) !== 1)
      .map((route) => route.key);
    expect(offending).toEqual([]);
  });

  it('runs every wedding route behind WeddingAccessGuard', () => {
    const offending = weddingRoutes
      .filter((route) => !route.guards.includes(WeddingAccessGuard))
      .map((route) => route.key);
    expect(offending).toEqual([]);
  });

  it('checks a declared permission after the access guard', () => {
    for (const route of routes.filter((candidate) => candidate.permission)) {
      const access = route.guards.indexOf(WeddingAccessGuard);
      expect(access, route.key).toBeGreaterThanOrEqual(0);
      expect(route.guards.indexOf(PermissionGuard), route.key).toBeGreaterThan(access);
    }
  });

  it('declares only permissions of the catalogue, and only on wedding routes', () => {
    const offending = routes
      .filter((route) => route.permission)
      .filter(
        (route) =>
          !isWeddingRoute(route) ||
          !isModuleAction(route.permission!.module, route.permission!.action),
      )
      .map((route) => route.key);
    expect(offending).toEqual([]);
  });

  it('marks membership only nowhere but the exempt routes', () => {
    const offending = routes
      .filter((route) => route.membershipOnly && !MEMBERSHIP_ONLY_ROUTES.has(route.key))
      .map((route) => route.key);
    expect(offending).toEqual([]);
  });
});
