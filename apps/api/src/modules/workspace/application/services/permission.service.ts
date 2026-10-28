import { Injectable } from '@nestjs/common';
import {
  EffectivePermissions,
  evaluatePermissions,
} from '../../domain/rules/evaluate-permissions.js';
import type { Membership } from '../../domain/types/membership.js';

/**
 * Effective permissions of a membership (System Design §7.3, Database Design §8.4): role
 * defaults, overrides and protected actions. Evaluated on every request; nothing is cached,
 * so a role, override or status change applies from the member's next request.
 */
@Injectable()
export class PermissionService {
  evaluate(membership: Membership): EffectivePermissions {
    return evaluatePermissions(membership);
  }
}
