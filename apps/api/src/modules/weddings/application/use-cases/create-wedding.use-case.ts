import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { MembershipsService, OwnerMembershipExistsError } from '../../../workspace/index.js';
import { displayNameFor, WEDDING_TIMEZONE } from '../../domain/rules/wedding-rules.js';
import type { Wedding, WeddingDetails } from '../../domain/types/wedding.js';
import { WeddingsRepository } from '../../infrastructure/repositories/weddings.repository.js';
import { WeddingsErrors } from '../weddings-errors.js';

/**
 * Creates the user's wedding and makes the user its OWNER, in one transaction
 * (decision 0016). A user owns at most one wedding (0010 #18, decision 0012).
 */
@Injectable()
export class CreateWeddingUseCase {
  constructor(
    private readonly weddings: WeddingsRepository,
    private readonly memberships: MembershipsService,
    private readonly transactions: TransactionRunner,
  ) {}

  async execute(userId: string, details: WeddingDetails): Promise<Wedding> {
    if (await this.memberships.ownsAWedding(userId)) throw WeddingsErrors.alreadyOwned();

    try {
      return await this.transactions.run(async (transaction) => {
        const wedding = await this.weddings.create(
          {
            ...details,
            displayName: displayNameFor(details.brideName, details.groomName),
            timezone: WEDDING_TIMEZONE,
            createdBy: userId,
          },
          transaction,
        );
        await this.memberships.addOwner(wedding.id, userId, transaction);
        return wedding;
      });
    } catch (error) {
      // A concurrent request created the user's wedding first; this one was rolled back.
      if (error instanceof OwnerMembershipExistsError) throw WeddingsErrors.alreadyOwned();
      throw error;
    }
  }
}
