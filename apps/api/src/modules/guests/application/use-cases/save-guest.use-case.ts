import { Injectable } from '@nestjs/common';
import type { GuestChanges, GuestDetails, GuestSaveResult } from '../../domain/types/guest.js';
import { GuestsRepository } from '../../infrastructure/repositories/guests.repository.js';
import { GuestsErrors } from '../guests-errors.js';

/**
 * Creates and updates guests. Both return the other active guests with the same normalized
 * mobile as a warning; the save always succeeds and nothing is merged (0017 #13). Changing
 * a guest's contact details never touches their invitation token (0018 #4).
 */
@Injectable()
export class SaveGuestUseCase {
  constructor(private readonly guests: GuestsRepository) {}

  async create(weddingId: string, userId: string, details: GuestDetails): Promise<GuestSaveResult> {
    const guest = await this.guests.create({ ...details, weddingId, createdBy: userId });
    return { guest, duplicateMobileGuests: await this.duplicatesOf(weddingId, guest) };
  }

  async update(
    weddingId: string,
    guestId: string,
    changes: GuestChanges,
  ): Promise<GuestSaveResult> {
    const guest = await this.guests.update(weddingId, guestId, changes);
    if (!guest) throw GuestsErrors.notFound();
    return { guest, duplicateMobileGuests: await this.duplicatesOf(weddingId, guest) };
  }

  private duplicatesOf(weddingId: string, guest: { id: string; mobile: string }) {
    return this.guests.findDuplicateMobiles(weddingId, guest.mobile, guest.id);
  }
}
