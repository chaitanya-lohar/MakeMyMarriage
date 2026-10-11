import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/** Guards the DRAFT guest invitation copy (decision 0021). */
const copy = collectCopy(content);
const text = copy.map(([, value]) => value).join(' ');

describe('guest invitation copy', () => {
  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('sets no RSVP deadline and offers no Pending choice (0017 #4, 0021)', () => {
    expect(text).not.toMatch(/before the|deadline|by \d|\bpending\b/i);
  });

  it('offers no concierge, travel, dietary or contact form', () => {
    expect(text).not.toMatch(/concierge|travel|dietary|seat|reload/i);
  });
});
