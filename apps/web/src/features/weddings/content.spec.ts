import { describe, expect, it } from 'vitest';
import { collectCopy, v1CopyRules, violations } from '@/lib/v1-copy-guard';
import * as workspace from '@/features/workspace/content';
import * as content from './content';

/** Guards the approved wedding-setup and workspace copy (decision 0016). */
const copy = [...collectCopy(content), ...collectCopy(workspace)];

describe('wedding setup copy', () => {
  it('collects the copy under test', () => {
    expect(copy.length).toBeGreaterThan(60);
  });

  it.each(v1CopyRules.map((rule) => [rule.id, rule] as const))('does not claim %s', (_, rule) => {
    expect(violations(copy, rule), rule.reason).toEqual([]);
  });

  it('uses the approved placeholders and messages', () => {
    expect(content.weddingFields.brideName.placeholder).toBe('e.g. Meera Sharma');
    expect(content.weddingFields.groomName.placeholder).toBe('e.g. Arjun Patel');
    expect(content.weddingFields.venueName.placeholder).toBe('e.g. Lakeside Garden');
    expect(content.weddingFields.primaryCity.placeholder).toBe('e.g. Jaipur');
    expect(content.weddingFields.startDate.placeholder).toBe('DD / MM / YYYY');
    expect(content.weddingFields.description.placeholder).toBe(
      'A short message about your wedding',
    );
    expect(content.createWedding.submitting).toBe('Creating your wedding…');
    expect(content.dashboard.created).toBe('Your wedding has been created.');
    expect(content.weddingDetailsPage.saved).toBe('Your changes have been saved.');
    expect(workspace.workspaceFooter.copyright).toBe('© 2026 MakeMyMarriage. All rights reserved.');
  });

  it('does not offer help contact that V1 does not have', () => {
    expect(copy.join(' ')).not.toMatch(/contact your wedding host|need help/i);
  });
});
