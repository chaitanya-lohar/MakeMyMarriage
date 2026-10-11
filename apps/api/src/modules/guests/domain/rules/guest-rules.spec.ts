import { describe, expect, it } from 'vitest';
import { isValidMobile, normalizeMobile } from './guest-rules.js';
import { RsvpMessages, rsvpCountError } from './rsvp-rules.js';

describe('isValidMobile', () => {
  it.each(['+91 98765 43210', '98765-43210', '9876543', '+123456789012345', '0141 222 3333'])(
    'accepts %s',
    (value) => {
      expect(isValidMobile(value)).toBe(true);
    },
  );

  it.each([
    '987654', // 6 digits
    '1234567890123456', // 16 digits
    '91+9876543210', // + not at the start
    '(98765) 43210', // brackets
    '98765.43210',
    'phone',
    '',
  ])('rejects %s', (value) => {
    expect(isValidMobile(value)).toBe(false);
  });
});

describe('normalizeMobile', () => {
  it('removes spaces and hyphens and keeps a leading +', () => {
    expect(normalizeMobile('+91 98765-43210')).toBe('+919876543210');
    expect(normalizeMobile('98765 43210')).toBe('9876543210');
  });
});

describe('rsvpCountError', () => {
  it('accepts only the four approved combinations', () => {
    expect(rsvpCountError('PENDING', null)).toBeNull();
    expect(rsvpCountError('MAYBE', null)).toBeNull();
    expect(rsvpCountError('DECLINED', 0)).toBeNull();
    expect(rsvpCountError('ATTENDING', 1)).toBeNull();
    expect(rsvpCountError('ATTENDING', 250)).toBeNull();
  });

  it('rejects every other combination', () => {
    expect(rsvpCountError('ATTENDING', 0)).toBe(RsvpMessages.attendingCount);
    expect(rsvpCountError('ATTENDING', null)).toBe(RsvpMessages.attendingCount);
    expect(rsvpCountError('ATTENDING', 2.5)).toBe(RsvpMessages.attendingCount);
    expect(rsvpCountError('ATTENDING', '2')).toBe(RsvpMessages.attendingCount);
    expect(rsvpCountError('DECLINED', null)).toBe(RsvpMessages.declinedCount);
    expect(rsvpCountError('DECLINED', 1)).toBe(RsvpMessages.declinedCount);
    expect(rsvpCountError('PENDING', 0)).toBe(RsvpMessages.noCount);
    expect(rsvpCountError('MAYBE', 2)).toBe(RsvpMessages.noCount);
  });
});
