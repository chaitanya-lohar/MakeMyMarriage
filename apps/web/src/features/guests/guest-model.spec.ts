import { describe, expect, it } from 'vitest';
import {
  countFor,
  emailStatusLabel,
  emptyGuestForm,
  failureText,
  formatDateTime,
  isValidMobile,
  rsvpSummary,
  toGuestPayload,
  validateGuestForm,
  whatsappShareUrl,
} from './guest-model';

describe('validateGuestForm', () => {
  it('needs a name and a valid mobile', () => {
    expect(validateGuestForm(emptyGuestForm)).toEqual({
      name: "Enter the guest's name.",
      mobile: 'Enter a valid mobile number.',
    });
    expect(
      validateGuestForm({ ...emptyGuestForm, name: 'Raju', mobile: '+91 98765-43210' }),
    ).toEqual({});
  });

  it('checks the email shape and the limits', () => {
    expect(
      validateGuestForm({
        name: 'R'.repeat(101),
        mobile: '9876543210',
        email: 'not-an-email',
        relation: 'X'.repeat(101),
        notes: 'N'.repeat(1001),
      }),
    ).toEqual({
      name: 'Use 100 characters or fewer.',
      email: 'Enter a valid email address.',
      relation: 'Use 100 characters or fewer.',
      notes: 'Use 1,000 characters or fewer.',
    });
  });
});

describe('isValidMobile', () => {
  it('follows the 7–15 digit rule', () => {
    expect(isValidMobile('9876543')).toBe(true);
    expect(isValidMobile('987654')).toBe(false);
    expect(isValidMobile('91+9876543210')).toBe(false);
  });
});

describe('toGuestPayload', () => {
  it('trims and sends null for empty optional fields', () => {
    expect(
      toGuestPayload({
        name: ' Raju ',
        mobile: ' 98765 43210 ',
        email: '',
        relation: 'Cousin',
        notes: ' ',
      }),
    ).toEqual({
      name: 'Raju',
      mobile: '98765 43210',
      email: null,
      relation: 'Cousin',
      notes: null,
    });
  });
});

describe('labels', () => {
  it('never shows Delivered', () => {
    const base = { isRevoked: false, lastSentAt: null, firstOpenedAt: null };
    expect(emailStatusLabel(null)).toBe('None');
    expect(emailStatusLabel({ ...base, deliveryStatus: 'DRAFT' })).toBe('Draft');
    expect(emailStatusLabel({ ...base, deliveryStatus: 'SENT' })).toBe('Sent');
    expect(emailStatusLabel({ ...base, deliveryStatus: 'DELIVERED' })).toBe('Sent');
    expect(emailStatusLabel({ ...base, deliveryStatus: 'FAILED' })).toBe('Failed');
  });

  it('summarises RSVPs with the count only when attending', () => {
    expect(rsvpSummary('ATTENDING', 2)).toBe('Attending · 2');
    expect(rsvpSummary('DECLINED', 0)).toBe('Declined');
    expect(rsvpSummary('PENDING', null)).toBe('Pending');
  });

  it('sends the count each status requires', () => {
    expect(countFor('ATTENDING', 3)).toBe(3);
    expect(countFor('DECLINED', 3)).toBe(0);
    expect(countFor('MAYBE', 3)).toBeNull();
    expect(countFor('PENDING', 3)).toBeNull();
  });

  it('words failures for organizers', () => {
    expect(failureText('SMTP 550')).toBe('The email address was rejected');
    expect(failureText('The email service could not be reached.')).toBe(
      'The email service could not be reached',
    );
  });
});

describe('formatDateTime', () => {
  it('writes India time with a 24-hour clock', () => {
    expect(formatDateTime('2027-01-13T03:45:00.000Z')).toBe('13 Jan 2027, 09:15');
  });
});

describe('whatsappShareUrl', () => {
  it('prefills the message with the first name, couple and link', () => {
    const url = whatsappShareUrl(
      'Raju Sharma',
      'Meera Sharma & Arjun Patel',
      'https://x.test/invite/t',
    );
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(
      "Dear Raju, you're warmly invited to the wedding celebrations of Meera Sharma & Arjun Patel. Please view your invitation and RSVP here: https://x.test/invite/t",
    );
  });
});
