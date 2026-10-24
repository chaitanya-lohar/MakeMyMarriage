import type { components } from '@makemymarriage/api-client';
export type ApiVendor = components['schemas']['VendorDto'];
export type ApiVendorView = components['schemas']['VendorViewDto'];
export type ApiBooking = components['schemas']['BookingDto'];
export type VendorCategory = ApiVendor['category'];
export type BookingStatus = ApiBooking['status'];
export const categories: VendorCategory[] = [
  'VENUE',
  'CATERING',
  'PHOTOGRAPHY_VIDEOGRAPHY',
  'DECORATION_FLOWERS',
  'MAKEUP_BEAUTY',
  'CLOTHING_JEWELLERY',
  'ENTERTAINMENT_DJ',
  'INVITATIONS_PRINTING',
  'TRANSPORTATION',
  'WEDDING_PLANNER',
  'MEHENDI',
  'OTHER',
];
export const bookingStatuses: BookingStatus[] = [
  'NOT_CONTACTED',
  'CONTACTED',
  'QUOTATION_RECEIVED',
  'NEGOTIATING',
  'BOOKED',
  'CANCELLED',
];
export function formatVendorDate(date: string | null) {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return '—';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
export function rupeesFromMinor(value: number | null) {
  return value === null
    ? '—'
    : `₹${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
