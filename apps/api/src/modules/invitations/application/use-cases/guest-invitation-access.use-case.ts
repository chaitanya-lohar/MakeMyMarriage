import { Injectable } from '@nestjs/common';
import { RateLimiter } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';
import { GuestsService, type GuestResponse, type InvitedEvent } from '../../../guests/index.js';
import { WeddingsService } from '../../../weddings/index.js';
import { GuestAccessLimits } from '../../domain/rules/guest-access-policy.js';
import type { Invitation } from '../../domain/types/invitation.js';
import { GuestInvitationsRepository } from '../../infrastructure/repositories/guest-invitations.repository.js';
import { InvitationHistoryRepository } from '../../infrastructure/repositories/invitation-history.repository.js';
import { InvitationsErrors } from '../invitations-errors.js';
import { InvitationTokensService } from '../services/invitation-tokens.service.js';

/** What a guest sees: only their own active events, never organizer data (Phase 4 PRD §7.2). */
export interface GuestInvitationView {
  guestName: string;
  wedding: { displayName: string; startDate: string | null; timezone: string };
  events: InvitedEvent[];
}

/**
 * The account-free guest routes (API Design §10). Unknown, revoked and regenerated tokens and
 * deleted guests' tokens all get the same INVITATION_NOT_FOUND, revealing nothing else.
 */
@Injectable()
export class GuestInvitationAccessUseCase {
  constructor(
    private readonly invitations: GuestInvitationsRepository,
    private readonly history: InvitationHistoryRepository,
    private readonly tokens: InvitationTokensService,
    private readonly guests: GuestsService,
    private readonly weddings: WeddingsService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  /** Opens the invitation and records the open; opens never change the delivery status. */
  async open(token: string, ip: string): Promise<GuestInvitationView> {
    const invitation = await this.resolve(token, ip);
    const view = await this.viewOf(invitation);
    const now = new Date();
    await this.history.recordOpen(invitation.weddingId, invitation.id, now);
    await this.invitations.recordOpen(invitation.id, now);
    return view;
  }

  /**
   * Applies the guest's responses, all or nothing; a guest can never send PENDING (callers
   * have validated the answers). A response for an event not on the invitation rejects them all.
   */
  async respond(
    token: string,
    ip: string,
    responses: GuestResponse[],
  ): Promise<GuestInvitationView> {
    const invitation = await this.resolve(token, ip);
    const applied = await this.guests.respondAsGuest(
      invitation.weddingId,
      invitation.guestId,
      responses,
    );
    if (!applied) throw InvitationsErrors.notOnInvitation();
    return this.viewOf(invitation);
  }

  private async resolve(token: string, ip: string): Promise<Invitation> {
    const [byIp, byToken] = await Promise.all([
      this.rateLimiter.hit(GuestAccessLimits.perIp, ip),
      this.rateLimiter.hit(GuestAccessLimits.perToken, token),
    ]);
    if (byIp > GuestAccessLimits.perIp.limit || byToken > GuestAccessLimits.perToken.limit) {
      throw InvitationsErrors.rateLimited();
    }

    if (!this.tokens.isWellFormed(token)) throw InvitationsErrors.notFound();
    const invitation = await this.invitations.findByTokenHash(this.tokens.hash(token));
    if (!invitation) throw InvitationsErrors.notFound();
    // Deleting a guest revokes the token; this also covers a deletion in progress.
    if (!(await this.guests.findActive(invitation.weddingId, invitation.guestId))) {
      throw InvitationsErrors.notFound();
    }
    return invitation;
  }

  private async viewOf(invitation: Invitation): Promise<GuestInvitationView> {
    const [guest, wedding, events] = await Promise.all([
      this.guests.findActive(invitation.weddingId, invitation.guestId),
      this.weddings.findById(invitation.weddingId),
      this.guests.invitedEvents(invitation.weddingId, invitation.guestId),
    ]);
    if (!guest || !wedding) throw InvitationsErrors.notFound();
    return {
      guestName: guest.name,
      wedding: {
        displayName: wedding.displayName,
        startDate: wedding.startDate,
        timezone: wedding.timezone,
      },
      events,
    };
  }
}
