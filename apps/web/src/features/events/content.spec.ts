import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/** Guards the DRAFT events copy (decision 0021) against claims outside V1. */
const copy = collectCopy(content);

describe('events copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(40);
  });

  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('offers exactly the seven event types', () => {
    expect(Object.keys(content.eventTypeLabels)).toEqual([
      'ENGAGEMENT',
      'MEHENDI',
      'HALDI',
      'SANGEET',
      'WEDDING',
      'RECEPTION',
      'CUSTOM',
    ]);
  });

  it('never mentions maps, cover images, itineraries or public events (0017 #15, 0021)', () => {
    expect(copy.map(([, text]) => text).join(' ')).not.toMatch(
      /\bmap\b|cover image|itinerary|public|instructions/i,
    );
  });
});
