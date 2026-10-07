import { Injectable } from '@nestjs/common';
import { displayNameFor } from '../../domain/rules/wedding-rules.js';
import type { Wedding, WeddingDetails } from '../../domain/types/wedding.js';
import { WeddingsRepository } from '../../infrastructure/repositories/weddings.repository.js';
import { WeddingsErrors } from '../weddings-errors.js';

/**
 * Updates a wedding's details; the display name follows the couple's names
 * (decision 0016). Membership is checked by WeddingAccessGuard before this runs; only
 * OWNER members exist until organizers arrive (Phase 10).
 */
@Injectable()
export class UpdateWeddingUseCase {
  constructor(private readonly weddings: WeddingsRepository) {}

  async execute(weddingId: string, changes: Partial<WeddingDetails>): Promise<Wedding> {
    const current = await this.weddings.findById(weddingId);
    if (!current) throw WeddingsErrors.notFound();

    const brideName = changes.brideName ?? current.brideName;
    const groomName = changes.groomName ?? current.groomName;
    const updated = await this.weddings.update(weddingId, {
      ...changes,
      displayName: displayNameFor(brideName, groomName),
    });
    if (!updated) throw WeddingsErrors.notFound();
    return updated;
  }
}
