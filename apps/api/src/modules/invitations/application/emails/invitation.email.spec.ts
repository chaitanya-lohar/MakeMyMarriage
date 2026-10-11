import { describe, expect, it } from 'vitest';
import { formatLongDate, invitationEmail } from './invitation.email.js';

const input = {
  to: 'raju.sharma@example.com',
  guestName: 'Raju Sharma',
  brideName: 'Meera Sharma',
  groomName: 'Arjun Patel',
  weddingDate: '2027-02-18',
  city: 'Jaipur',
  invitationUrl: 'https://makemymarriage.com/invite/abc',
};

describe('formatLongDate', () => {
  it('writes the weekday, day, month and year', () => {
    expect(formatLongDate('2027-02-18')).toBe('Thursday, 18 February 2027');
    expect(formatLongDate('2027-02-16')).toBe('Tuesday, 16 February 2027');
  });
});

describe('invitationEmail', () => {
  it('names the couple, the date and the city, and links to the invitation', () => {
    const email = invitationEmail(input);
    expect(email.to).toBe('raju.sharma@example.com');
    expect(email.subject).toBe("You're invited: Meera Sharma & Arjun Patel");
    expect(email.text).toContain('Dear Raju Sharma,');
    expect(email.text).toContain(
      "You're warmly invited to celebrate the wedding of Meera Sharma & Arjun Patel on Thursday, 18 February 2027 in Jaipur.",
    );
    expect(email.text).toContain('View invitation and RSVP: https://makemymarriage.com/invite/abc');
    expect(email.text).toContain('Meera & Arjun');
    expect(email.html).toContain('href="https://makemymarriage.com/invite/abc"');
  });

  it('leaves out a missing date or city without empty labels (0021)', () => {
    expect(invitationEmail({ ...input, weddingDate: null }).text).toContain(
      'the wedding of Meera Sharma & Arjun Patel in Jaipur.',
    );
    expect(invitationEmail({ ...input, city: null }).text).toContain(
      'the wedding of Meera Sharma & Arjun Patel on Thursday, 18 February 2027.',
    );
    const neither = invitationEmail({ ...input, weddingDate: null, city: null });
    expect(neither.text).toContain('the wedding of Meera Sharma & Arjun Patel.');
    expect(neither.text).not.toMatch(/ on \.| in \.|null|undefined/);
  });

  it('escapes names in the HTML', () => {
    const email = invitationEmail({ ...input, guestName: '<script>x</script>' });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});
