import { describe, expect, it } from 'vitest';
import { footerProductLinks, headerLinks, legalLinks } from '@/components/layout/site-links';
import * as content from './content';

/**
 * Guards the approved home page copy (decision 0014): the page must describe V1 as the
 * PRD defines it. Each pattern is a claim that was removed during copy review; the test
 * fails if one reappears in the copy or mock-up data.
 */
const outOfScopeClaims: [RegExp, string][] = [
  [
    /accommodation|room allocat|hotel|travel|airport|guest stays/i,
    'accommodation/transport are V1 non-goals (PRD §5)',
  ],
  [/budget|forecast|cash ?flow/i, 'expense tracker, not a budgeting product (PRD §15)'],
  [/moderat|approval required/i, 'guest photos publish with no approval step (PRD §20)'],
  [/video/i, 'photos only in V1 (PRD §20)'],
  [/broadcast|whatsapp (api|reminder|message)/i, 'no WhatsApp API in V1 (PRD §5, §13)'],
  [/gift registry|registry/i, 'not a V1 website page (PRD §19)'],
  [/family unit|household|party of|party size/i, 'RSVP is per guest and event (PRD §11)'],
  [/dietary/i, 'not a V1 guest field (PRD §10)'],
  [/password|\bpin\b/i, 'no password-protected websites in V1 (PRD §19)'],
  [/screen ?cast|live display/i, 'not a V1 capability'],
  [/\b4k\b|zero compression|high[- ]res/i, 'media quality not committed'],
  [/\bzip\b|\bcsv\b|one-click export|data export/i, 'export formats not approved (PRD §26)'],
  [/intelligent|\bai\b/i, 'AI assistant is a V1 non-goal (PRD §5)'],
  [
    /trusted by|testimonial|\brated\b|\d+\+? (couples|weddings) (use|trust)/i,
    'no social proof before launch',
  ],
  [/\bfree\b|upgrade|credit card|pricing|\bplans? from\b/i, 'no approved pricing model'],
  [/concierge|editorial press|vendor directory|security architecture/i, 'not a V1 destination'],
  [
    /encrypt|certified|compliant|gdpr|iso ?27001|soc ?2/i,
    'unimplemented security/compliance claim',
  ],
  [/\binc\b|pvt|private limited|\bllp\b/i, 'no legal entity suffix'],
  [/unlimited/i, 'not stated by the PRD'],
  [/live sync|real[- ]time/i, 'not a V1 capability'],
  [/\bpartners?\b(?! connection)/i, '"partner" means the bride or groom, never a vendor'],
  [/2025/, 'sample dates must not be in the past'],
];

// Fields that hold identifiers (icon names, colour tones, asset paths), not visible copy.
const nonCopyKeys = new Set(['icon', 'tone', 'whenTone', 'noteTone', 'colour', 'src']);

function collectStrings(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') {
    out.push([path, value]);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (!nonCopyKeys.has(key)) collectStrings(item, `${path}.${key}`, out);
    }
  }
}

const copy: [string, string][] = [];
collectStrings(content, 'content', copy);
collectStrings({ headerLinks, footerProductLinks, legalLinks }, 'links', copy);

describe('home page copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(100);
  });

  it.each(outOfScopeClaims)('does not claim %s', (pattern, reason) => {
    const offending = copy
      .filter(([, text]) => pattern.test(text))
      .map(([path, text]) => `${path}: "${text}"`);
    expect(offending, reason).toEqual([]);
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
