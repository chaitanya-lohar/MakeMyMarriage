import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import type { Wedding } from '../../domain/types/wedding.js';
import { WeddingsRepository } from '../../infrastructure/repositories/weddings.repository.js';

/**
 * Read access to weddings for other modules (events copy the timezone; invitations and
 * the dashboard show the couple's details). Callers have already checked membership.
 */
@Injectable()
export class WeddingsService {
  constructor(private readonly weddings: WeddingsRepository) {}

  /** The wedding, or null when it is missing or deleted. */
  findById(weddingId: string): Promise<Wedding | null> {
    return this.weddings.findById(weddingId);
  }

  /**
   * Serializes owner changes (decision 0038): call first in every transaction that changes
   * the wedding's owners. False when the wedding is missing or deleted.
   */
  bumpOwnersVersion(weddingId: string, transaction: Transaction): Promise<boolean> {
    return this.weddings.bumpOwnersVersion(weddingId, transaction);
  }
}
