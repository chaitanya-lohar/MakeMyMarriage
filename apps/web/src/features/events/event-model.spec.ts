import { describe, expect, it } from 'vitest';
import {
  emptyEventForm,
  errorsFromApi,
  formatEventWhen,
  isPast,
  toEventPayload,
  validateEventForm,
} from './event-model';

const valid = {
  ...emptyEventForm,
  name: 'Mehendi',
  type: 'MEHENDI' as const,
  date: '2027-02-16',
};

describe('validateEventForm', () => {
  it('needs a name, a type and a real date', () => {
    expect(validateEventForm(emptyEventForm)).toEqual({
      name: 'Enter the event name.',
      type: 'Choose an event type.',
      date: 'Enter a valid date.',
    });
    expect(validateEventForm({ ...valid, date: '2027-02-30' })).toEqual({
      date: 'Enter a valid date.',
    });
    expect(validateEventForm(valid)).toEqual({});
  });

  it('needs a start time before an end time, and the end later the same day', () => {
    expect(validateEventForm({ ...valid, endTime: '20:00' }).endTime).toBe(
      'Add a start time before an end time.',
    );
    expect(validateEventForm({ ...valid, startTime: '20:00', endTime: '20:00' }).endTime).toBe(
      'The end time must be after the start time.',
    );
    expect(validateEventForm({ ...valid, startTime: '4 pm' }).startTime).toBe(
      'Enter a time as HH:mm.',
    );
    expect(validateEventForm({ ...valid, startTime: '16:00', endTime: '20:00' })).toEqual({});
  });

  it('applies the approved limits', () => {
    const errors = validateEventForm({
      ...valid,
      name: 'N'.repeat(101),
      venueName: 'V'.repeat(121),
      venueAddress: 'A'.repeat(301),
      notes: 'X'.repeat(1001),
    });
    expect(errors).toEqual({
      name: 'Use 100 characters or fewer.',
      venueName: 'Use 120 characters or fewer.',
      venueAddress: 'Use 300 characters or fewer.',
      notes: 'Use 1,000 characters or fewer.',
    });
  });
});

describe('toEventPayload', () => {
  it('sends the calendar date and null for empty optional fields', () => {
    expect(toEventPayload({ ...valid, venueName: ' Garden Palace ' })).toEqual({
      name: 'Mehendi',
      type: 'MEHENDI',
      date: '2027-02-16',
      startTime: null,
      endTime: null,
      description: null,
      venue: { name: 'Garden Palace', address: null },
      dressCode: null,
      notes: null,
    });
  });
});

describe('errorsFromApi', () => {
  it('maps nested venue fields onto the form', () => {
    expect(errorsFromApi({ 'venue.name': ['Too long'], endTime: ['Bad'], other: ['x'] })).toEqual({
      venueName: 'Too long',
      endTime: 'Bad',
    });
  });
});

describe('formatEventWhen', () => {
  it('writes the date and 24-hour times, or the date alone', () => {
    expect(formatEventWhen({ date: '2027-02-16', startTime: '16:00', endTime: '20:00' })).toBe(
      'Tuesday, 16 February 2027 · 16:00 – 20:00',
    );
    expect(formatEventWhen({ date: '2027-02-17', startTime: '10:00', endTime: null })).toBe(
      'Wednesday, 17 February 2027 · 10:00',
    );
    expect(formatEventWhen({ date: '2027-02-18', startTime: null, endTime: null })).toBe(
      'Thursday, 18 February 2027',
    );
  });
});

describe('isPast', () => {
  it('is past only before today', () => {
    expect(isPast({ date: '2027-02-15' }, '2027-02-16')).toBe(true);
    expect(isPast({ date: '2027-02-16' }, '2027-02-16')).toBe(false);
  });
});
