import { Injectable } from '@nestjs/common';
import { MembershipsService, MemberType, type Membership } from '../../../workspace/index.js';
import type { Wedding } from '../../domain/types/wedding.js';
import { WeddingsRepository } from '../../infrastructure/repositories/weddings.repository.js';

export interface MyWedding {
  wedding: Wedding;
  membership: Membership;
}

/**
 * The weddings the user is an ACTIVE member of, each with the user's own membership, for
 * the wedding selector (API Design §6, decision 0035): the owned wedding first, then by
 * start date (undated last), then by name.
 */
@Injectable()
export class ListWeddingsUseCase {
  constructor(
    private readonly weddings: WeddingsRepository,
    private readonly memberships: MembershipsService,
  ) {}

  async execute(userId: string): Promise<MyWedding[]> {
    const memberships = await this.memberships.listActiveForUser(userId);
    const weddings = await this.weddings.findManyByIds(memberships.map((m) => m.weddingId));
    const byId = new Map(weddings.map((wedding) => [wedding.id, wedding]));
    const mine = memberships.flatMap((membership) => {
      const wedding = byId.get(membership.weddingId);
      return wedding ? [{ wedding, membership }] : [];
    });
    const owned = (item: MyWedding) => Number(item.membership.memberType === MemberType.Owner);
    return mine.sort(
      (a, b) =>
        owned(b) - owned(a) ||
        (a.wedding.startDate ?? '9999-99-99').localeCompare(b.wedding.startDate ?? '9999-99-99') ||
        a.wedding.displayName.localeCompare(b.wedding.displayName, 'en-IN'),
    );
  }
}
