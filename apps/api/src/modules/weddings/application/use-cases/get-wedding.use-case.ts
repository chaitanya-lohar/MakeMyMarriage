import { Injectable } from '@nestjs/common';
import type { Wedding } from '../../domain/types/wedding.js';
import { WeddingsRepository } from '../../infrastructure/repositories/weddings.repository.js';
import { WeddingsErrors } from '../weddings-errors.js';

/** One wedding. Membership is checked by WeddingAccessGuard before this runs. */
@Injectable()
export class GetWeddingUseCase {
  constructor(private readonly weddings: WeddingsRepository) {}

  async execute(weddingId: string): Promise<Wedding> {
    const wedding = await this.weddings.findById(weddingId);
    if (!wedding) throw WeddingsErrors.notFound();
    return wedding;
  }
}
