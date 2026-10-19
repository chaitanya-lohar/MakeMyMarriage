import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as content from './content';

/** Guards the DRAFT tasks copy (decisions 0026 and 0027). */
const copy = collectCopy(content);
const text = copy.map(([, value]) => value).join(' ');

describe('tasks copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(80);
  });

  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('uses exactly the approved statuses and priorities (0010 #3, 0026)', () => {
    expect(Object.values(content.statusLabels)).toEqual([
      'To do',
      'In progress',
      'Blocked',
      'Completed',
      'Cancelled',
    ]);
    expect(Object.values(content.priorityLabels)).toEqual(['Low', 'Medium', 'High', 'Urgent']);
  });

  it('never offers what Phase 7 leaves out (0026 #2)', () => {
    expect(text).not.toMatch(
      /attach|upload|comment|remind|notif|recurr|repeat|template|checklist|export|report|\bboard\b|kanban|bulk|invite/i,
    );
  });
});
