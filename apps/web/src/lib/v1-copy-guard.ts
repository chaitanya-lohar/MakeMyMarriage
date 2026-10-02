/**
 * Claims that must not appear in public copy because they exceed V1 as the PRD defines it
 * (decisions 0014 and 0015). Each was removed during copy review; specs use these rules
 * to fail the build if one reappears. Test-only — not imported by application code.
 */
export interface CopyRule {
  id: string;
  pattern: RegExp;
  reason: string;
}

export const v1CopyRules: CopyRule[] = [
  {
    id: 'accommodation',
    pattern: /accommodation|room allocat|hotel|travel|airport|guest stays|guest suites/i,
    reason: 'accommodation/transport are V1 non-goals (PRD §5)',
  },
  {
    id: 'budgeting',
    pattern: /budget|forecast|cash ?flow/i,
    reason: 'expense tracker, not a budgeting product (PRD §15)',
  },
  {
    id: 'moderation',
    pattern: /moderat|approval required/i,
    reason: 'guest photos publish with no approval step (PRD §20)',
  },
  { id: 'video', pattern: /video/i, reason: 'photos only in V1 (PRD §20)' },
  {
    id: 'whatsapp-api',
    pattern: /broadcast|whatsapp (api|reminder|message)/i,
    reason: 'no WhatsApp API in V1 (PRD §5, §13)',
  },
  { id: 'registry', pattern: /registry/i, reason: 'not a V1 website page (PRD §19)' },
  {
    id: 'family-rsvp',
    pattern: /family unit|household|party of|party size/i,
    reason: 'RSVP is per guest and event (PRD §11)',
  },
  { id: 'dietary', pattern: /dietary/i, reason: 'not a V1 guest field (PRD §10)' },
  {
    id: 'password-protected-site',
    pattern: /password|\bpin\b/i,
    reason: 'no password-protected websites in V1 (PRD §19)',
  },
  { id: 'screen-casting', pattern: /screen ?cast|live display/i, reason: 'not a V1 capability' },
  {
    id: 'media-quality',
    pattern: /\b4k\b|zero compression|high[- ]res/i,
    reason: 'media quality not committed',
  },
  {
    id: 'exports',
    pattern: /\bzip\b|\bcsv\b|one-click export|data export/i,
    reason: 'export formats not approved (PRD §26)',
  },
  { id: 'ai', pattern: /intelligent|\bai\b/i, reason: 'AI assistant is a V1 non-goal (PRD §5)' },
  {
    id: 'social-proof',
    pattern: /trusted by|testimonial|\brated\b|verified|\d+\+? (couples|weddings) (use|trust)/i,
    reason: 'no social proof before launch',
  },
  {
    id: 'pricing',
    pattern: /\bfree\b|upgrade|credit card|pricing|\bplans? from\b/i,
    reason: 'no approved pricing model',
  },
  {
    id: 'destinations',
    pattern: /concierge|editorial press|vendor directory|security architecture/i,
    reason: 'not a V1 destination',
  },
  {
    id: 'security-claims',
    pattern: /encrypt|certified|compliant|gdpr|iso ?27001|soc ?2/i,
    reason: 'unimplemented security/compliance claim',
  },
  {
    id: 'legal-entity',
    pattern: /\binc\b|pvt|private limited|\bllp\b/i,
    reason: 'no legal entity suffix',
  },
  { id: 'unlimited', pattern: /unlimited/i, reason: 'not stated by the PRD' },
  { id: 'realtime', pattern: /live sync|real[- ]time/i, reason: 'not a V1 capability' },
  {
    id: 'delivery-time',
    pattern: /within \d+ (minutes?|hours?)/i,
    reason: 'no delivery-time promise',
  },
  {
    id: 'partner-as-vendor',
    pattern: /\bpartners?\b(?! connection)/i,
    reason: '"partner" means the bride or groom, never a vendor',
  },
  { id: 'past-dates', pattern: /2025/, reason: 'sample dates must not be in the past' },
];

// Fields that hold identifiers (icon names, colour tones, asset paths), not visible copy.
const nonCopyKeys = new Set(['icon', 'tone', 'whenTone', 'noteTone', 'colour', 'src']);

/** Every string in a content object, with its path, for checking against the rules. */
export function collectCopy(value: unknown, path = 'content'): [string, string][] {
  const out: [string, string][] = [];
  const visit = (node: unknown, at: string) => {
    if (typeof node === 'string') out.push([at, node]);
    else if (Array.isArray(node)) node.forEach((item, index) => visit(item, `${at}[${index}]`));
    else if (node && typeof node === 'object') {
      for (const [key, item] of Object.entries(node)) {
        if (!nonCopyKeys.has(key)) visit(item, `${at}.${key}`);
      }
    }
  };
  visit(value, path);
  return out;
}

export function violations(copy: [string, string][], rule: CopyRule): string[] {
  return copy.filter(([, text]) => rule.pattern.test(text)).map(([at, text]) => `${at}: "${text}"`);
}
