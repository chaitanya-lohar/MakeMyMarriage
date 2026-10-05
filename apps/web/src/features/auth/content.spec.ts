import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/**
 * Guards the approved auth copy (decision 0015). Password fields are part of sign-in, so
 * only the "password-protected website" rule is skipped here.
 */
const rules = v1CopyRules.filter((rule) => rule.id !== 'password-protected-site');
const copy = collectCopy(content);

describe('auth copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(50);
  });

  it.each(rules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('uses the approved reset and session messages', () => {
    expect(content.signIn.passwordUpdated).toBe(
      'Your password has been updated. Please sign in with your new password.',
    );
    expect(content.signIn.sessionEnded).toBe('Your session has ended. Please sign in again.');
    expect(content.forgotPassword.sent).toMatch(/^Check your inbox — if an account exists/);
    expect(content.authFooter.copyright).toBe('© 2026 MakeMyMarriage. All rights reserved.');
    expect(content.invalidEmail).toBe('Please enter a valid email address.');
  });
});
