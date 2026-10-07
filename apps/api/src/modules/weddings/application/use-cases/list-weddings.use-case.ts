import { Injectable } from '@nestjs/common';
import { MembershipsService } from '../../../workspace/index.js';
import type { Wedding } from '../../domain/types/wedding.js';
import { WeddingsRepository } from '../../infrastructure/repositories/weddings.repository.js';

/** The weddings the user is an ACTIVE member of, oldest membership first (decision 0016). */
@Injectable()
export class ListWeddingsUseCase {
  constructor(
    private readonly weddings: WeddingsRepository,
    private readonly memberships: MembershipsService,
  ) {}

  async execute(userId: string): Promise<Wedding[]> {
    return this.weddings.findManyByIds(await this.memberships.activeWeddingIds(userId));
  }
}
