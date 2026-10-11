import { Injectable } from '@nestjs/common';
import type { Guest } from '../../domain/types/guest.js';
import { GuestsRepository } from '../../infrastructure/repositories/guests.repository.js';
import { GuestsErrors } from '../guests-errors.js';

/** Guest reads and deletion — the guests module's service for its controllers. */
@Injectable()
export class GuestsService {
  constructor(private readonly guests: GuestsRepository) {}

  /** The active guest, or GUEST_NOT_FOUND. */
  async getActive(weddingId: string, guestId: string): Promise<Guest> {
    const guest = await this.guests.findActive(weddingId, guestId);
    if (!guest) throw GuestsErrors.notFound();
    return guest;
  }

  /** Soft-deletes the guest; their assignments, RSVPs and history are kept (Phase 4 PRD §4). */
  async delete(weddingId: string, guestId: string, userId: string): Promise<void> {
    if (!(await this.guests.softDelete(weddingId, guestId, userId))) throw GuestsErrors.notFound();
  }
}
