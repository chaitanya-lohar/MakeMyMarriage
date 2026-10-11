import { describe, expect, it } from 'vitest';
import { answersFrom, coupleLines, stepPeople, toResponses, type GuestView } from './rsvp-model';

const event = (guestEventId: string, rsvpStatus: string, attendeeCount: number | null) =>
  ({
    guestEventId,
    name: guestEventId,
    type: 'HALDI',
    date: '2027-02-17',
    startTime: null,
    endTime: null,
    venue: { name: null, address: null },
    dressCode: null,
    description: null,
    rsvpStatus,
    attendeeCount,
  }) as GuestView['events'][number];

describe('answersFrom', () => {
  it('starts unanswered events with no choice, and answered ones as saved', () => {
    const view = {
      guest: { name: 'Raju' },
      wedding: { displayName: 'A & B', startDate: null, timezone: 'Asia/Kolkata' },
      events: [event('haldi', 'ATTENDING', 3), event('sangeet', 'PENDING', null)],
    } as GuestView;
    expect(answersFrom(view)).toEqual({
      haldi: { choice: 'ATTENDING', people: '3' },
      sangeet: { choice: null, people: '1' },
    });
  });
});

describe('toResponses', () => {
  it('sends only answered events, with the count each status requires', () => {
    expect(
      toResponses({
        haldi: { choice: 'ATTENDING', people: '4' },
        sangeet: { choice: 'DECLINED', people: '1' },
        mehendi: { choice: 'MAYBE', people: '1' },
        wedding: { choice: null, people: '1' },
      }),
    ).toEqual([
      { guestEventId: 'haldi', rsvpStatus: 'ATTENDING', attendeeCount: 4 },
      { guestEventId: 'sangeet', rsvpStatus: 'DECLINED', attendeeCount: 0 },
      { guestEventId: 'mehendi', rsvpStatus: 'MAYBE', attendeeCount: null },
    ]);
  });

  it('refuses an attending count below 1, with no upper limit', () => {
    expect(toResponses({ haldi: { choice: 'ATTENDING', people: '0' } })).toBeNull();
    expect(toResponses({ haldi: { choice: 'ATTENDING', people: '' } })).toBeNull();
    expect(toResponses({ haldi: { choice: 'ATTENDING', people: '250' } })).toEqual([
      { guestEventId: 'haldi', rsvpStatus: 'ATTENDING', attendeeCount: 250 },
    ]);
  });
});

describe('coupleLines', () => {
  it('splits the couple for the two-line heading', () => {
    expect(coupleLines('Meera Sharma & Arjun Patel')).toEqual(['Meera Sharma', 'Arjun Patel']);
  });
});

describe('stepPeople', () => {
  it('steps by one, never below 1, with no upper limit', () => {
    expect(stepPeople('2', 1)).toBe('3');
    expect(stepPeople('1', -1)).toBe('1');
    expect(stepPeople('', 1)).toBe('1');
    expect(stepPeople('999', 1)).toBe('1000');
  });
});
