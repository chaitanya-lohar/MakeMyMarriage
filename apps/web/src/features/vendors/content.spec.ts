import { describe, expect, it } from 'vitest';
import { bookingStatusLabels, vendorCategories, vendorCopy } from './content';
import { bookingStatuses, categories } from './vendor-model';

describe('vendor copy and options', () => {
  it('matches the approved Phase 9 categories and booking statuses', () => {
    expect(categories).toEqual(Object.keys(vendorCategories));
    expect(bookingStatuses).toEqual(Object.keys(bookingStatusLabels));
  });

  it('keeps cancellation immediate and reopening explicit', () => {
    expect(vendorCopy.cancelled).toBe('Booking cancelled.');
    expect(vendorCopy.cancel).toBe('Cancel booking');
    expect(vendorCopy.reopen).toBe('Reopen');
    expect(vendorCopy.cancelledBanner).toContain('Choose another status');
  });
});
