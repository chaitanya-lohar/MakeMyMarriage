import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/** Guards the DRAFT guests, RSVP and invitation copy (decision 0021). */
const copy = collectCopy(content);
const text = copy.map(([, value]) => value).join(' ');

describe('guests copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(100);
  });

  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('never shows Delivered as a status (0019 #8)', () => {
    expect(Object.values(content.emailStatusLabels)).toEqual(['None', 'Draft', 'Sent', 'Failed']);
    // Only the note that an open is not proof of delivery may mention it.
    const mentions = copy.filter(([, value]) => /deliver/i.test(value)).map(([at]) => at);
    expect(mentions).toEqual(['content.invitationPanel.openedNote']);
  });

  it('uses the only approved link-state label (0021)', () => {
    expect(content.linkRevoked).toBe('Revoked — this link no longer works');
    expect(text).not.toMatch(/\bActive\b/);
  });

  it('never offers SMS, reminders, seats or a guest limit', () => {
    expect(text).not.toMatch(/\bsms\b|remind|seat|maximum|capacity/i);
  });
});
