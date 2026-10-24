export const VENDOR_CATEGORIES = [
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
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];
export const BOOKING_STATUSES = [
  'NOT_CONTACTED',
  'CONTACTED',
  'QUOTATION_RECEIVED',
  'NEGOTIATING',
  'BOOKED',
  'CANCELLED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const IN_PROGRESS_STATUSES = [
  'NOT_CONTACTED',
  'CONTACTED',
  'QUOTATION_RECEIVED',
  'NEGOTIATING',
] as const;
export const VENDOR_LIMITS = {
  name: 150,
  contactPerson: 150,
  email: 254,
  address: 500,
  website: 500,
  notes: 1000,
  priceMinor: 10_000_000_000,
} as const;
