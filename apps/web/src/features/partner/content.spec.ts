import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

const copy = collectCopy(content);

// The partner feature is the one place "partner" is the subject (decision 0038, Web): the
// rule that keeps the word from meaning a vendor elsewhere does not apply here.
const rules = v1CopyRules.filter((rule) => rule.id !== 'partner-as-vendor');

describe('partner copy (decision 0039)', () => {
  it.each(rules)('has no "$id" claim', (rule) => {
    expect(violations(copy, rule)).toEqual([]);
  });

  it('never labels a partner as bride or groom, or as a co-owner (0038 D9)', () => {
    const text = copy.map(([, value]) => value).join('\n');
    expect(text).not.toMatch(/\bbride\b|\bgroom\b|co-?owner|sole owner|primary owner/i);
  });
});
