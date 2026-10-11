import { describe, expect, it } from 'vitest';
import { EventMessages, eventTimesError, isLocalTime } from './event-rules.js';

describe('isLocalTime', () => {
  it.each(['00:00', '09:05', '16:00', '23:59'])('accepts %s', (value) => {
    expect(isLocalTime(value)).toBe(true);
  });

  it.each(['24:00', '9:05', '16:0', '16:60', '4 pm', '16:00:00', ''])('rejects %s', (value) => {
    expect(isLocalTime(value)).toBe(false);
  });
});

describe('eventTimesError', () => {
  it('allows no times, a start time only, or an end after the start', () => {
    expect(eventTimesError(null, null)).toBeNull();
    expect(eventTimesError('16:00', null)).toBeNull();
    expect(eventTimesError('16:00', '20:00')).toBeNull();
  });

  it('needs a start time before an end time', () => {
    expect(eventTimesError(null, '20:00')).toBe(EventMessages.endWithoutStart);
  });

  it('needs the end to be later the same day', () => {
    expect(eventTimesError('16:00', '16:00')).toBe(EventMessages.endNotAfterStart);
    expect(eventTimesError('22:00', '01:00')).toBe(EventMessages.endNotAfterStart);
  });
});
