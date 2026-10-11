import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/** Guards the DRAFT dashboard copy (decisions 0021, 0022). */
const copy = collectCopy(content);

describe('dashboard summaries copy', () => {
  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('offers no "View all", capacity or confirmation percentage (0021, 0022)', () => {
    expect(copy.map(([, text]) => text).join(' ')).not.toMatch(
      /view all|capacity|confirmed|%|cumulative attendees/i,
    );
  });
});
