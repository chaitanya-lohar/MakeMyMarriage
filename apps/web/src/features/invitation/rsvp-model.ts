import type { components } from '@makemymarriage/api-client';

export type GuestView = components['schemas']['GuestInvitationViewDto'];
export type GuestViewEvent = GuestView['events'][number];

/** What a guest can choose; never Pending (decision 0017 #4). */
export type GuestChoice = 'ATTENDING' | 'DECLINED' | 'MAYBE';

export interface Answer {
  choice: GuestChoice | null;
  /** As typed, for Attending. */
  people: string;
}

/** The form starts from the saved RSVPs; unanswered events have no choice. */
export function answersFrom(view: GuestView): Record<string, Answer> {
  return Object.fromEntries(
    view.events.map((event) => [
      event.guestEventId,
      {
        choice: event.rsvpStatus === 'PENDING' ? null : event.rsvpStatus,
        people: String(
          event.rsvpStatus === 'ATTENDING' && event.attendeeCount ? event.attendeeCount : 1,
        ),
      },
    ]),
  );
}

export function peopleValid(people: string): boolean {
  const count = Number(people);
  return /^\d+$/.test(people) && Number.isInteger(count) && count >= 1;
}

/** The stepper: one more or one fewer person, never below 1 (no upper limit — 0017 #2). */
export function stepPeople(people: string, delta: 1 | -1): string {
  const current = peopleValid(people) ? Number(people) : delta > 0 ? 0 : 1;
  return String(Math.max(1, current + delta));
}

/**
 * The RSVP request: one response per answered event, with the count its status requires
 * (0017 #2). Unanswered events are left out and stay awaiting a reply. Null when an attending
 * count is invalid.
 */
export function toResponses(answers: Record<string, Answer>) {
  const responses: {
    guestEventId: string;
    rsvpStatus: GuestChoice;
    attendeeCount: number | null;
  }[] = [];
  for (const [guestEventId, answer] of Object.entries(answers)) {
    if (!answer.choice) continue;
    if (answer.choice === 'ATTENDING') {
      if (!peopleValid(answer.people)) return null;
      responses.push({
        guestEventId,
        rsvpStatus: 'ATTENDING',
        attendeeCount: Number(answer.people),
      });
    } else {
      responses.push({
        guestEventId,
        rsvpStatus: answer.choice,
        attendeeCount: answer.choice === 'DECLINED' ? 0 : null,
      });
    }
  }
  return responses;
}

/** "Meera Sharma & Arjun Patel" → ["Meera Sharma", "Arjun Patel"] for the two-line heading. */
export function coupleLines(displayName: string): string[] {
  const parts = displayName.split(' & ');
  return parts.length === 2 ? parts : [displayName];
}
