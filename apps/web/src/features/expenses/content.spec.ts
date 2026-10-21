import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/** Guards the DRAFT expenses copy (decisions 0028 and 0029). */
const copy = collectCopy(content);
const text = copy.map(([, value]) => value).join(' ');

describe('expenses copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(100);
  });

  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('uses exactly the approved categories, statuses and methods (0010 #7, 0018, 0028)', () => {
    expect(Object.values(content.categoryLabels)).toEqual([
      'Venue',
      'Catering',
      'Decoration',
      'Photography',
      'Clothing',
      'Jewellery',
      'Makeup',
      'Entertainment',
      'Invitations',
      'Gifts',
      'Miscellaneous',
    ]);
    expect(Object.values(content.paymentStatusLabels)).toEqual([
      'Pending',
      'Partially paid',
      'Paid',
    ]);
    expect(Object.values(content.methodLabels)).toEqual([
      'Cash',
      'UPI',
      'Bank transfer',
      'Card',
      'Cheque',
      'Other',
    ]);
  });

  it('never offers what Phase 8 leaves out (0028 #2, #3, #4)', () => {
    expect(text).not.toMatch(
      /budget|forecast|estimate|receipt|upload|vendor|export|report|remind|recurr|split|currency|refund|cancelled|%/i,
    );
  });
});
