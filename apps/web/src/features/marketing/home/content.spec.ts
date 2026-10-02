import { describe, expect, it } from 'vitest';
import { footerProductLinks, headerLinks, legalLinks } from '@/components/layout/site-links';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/**
 * Guards the approved home page copy (decision 0014): the page must describe V1 as the
 * PRD defines it.
 */
const copy = [
  ...collectCopy(content),
  ...collectCopy({ headerLinks, footerProductLinks, legalLinks }, 'links'),
];

describe('home page copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(100);
  });

  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('describes RSVP with the V1 statuses only', () => {
    const statuses = content.guests.rows.map((row) => row.rsvp);
    for (const status of statuses) {
      expect(['Attending', 'Pending', 'Declined', 'Maybe']).toContain(status);
    }
  });

  it('uses the approved expense categories in the spending breakdown', () => {
    const approved = [
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
    ];
    for (const category of content.expensesAndVendors.expenses.categories) {
      expect(approved).toContain(category.label);
    }
  });
});
