import type { BookingStatus, VendorCategory } from '../rules/vendor-rules.js';
export interface Vendor {
  id: string;
  weddingId: string;
  name: string;
  category: VendorCategory;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface Booking {
  id: string;
  weddingId: string;
  vendorId: string;
  vendorName: string;
  title: string;
  status: BookingStatus;
  bookingDate: string | null;
  serviceDate: string | null;
  eventId: string | null;
  eventName: string | null;
  agreedPriceMinor: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface VendorCounts {
  booked: number;
  inProgress: number;
  cancelled: number;
}
export interface VendorView {
  vendor: Vendor;
  bookingCounts: VendorCounts;
}
export interface VendorDetails {
  name: string;
  category: VendorCategory;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
}
export interface BookingDetails {
  title: string;
  status: BookingStatus;
  bookingDate: string | null;
  serviceDate: string | null;
  eventId: string | null;
  agreedPriceMinor: number | null;
  notes: string | null;
}
export interface VendorSummary {
  activeVendors: number;
  bookedVendors: number;
  bookingsNeedingFollowUp: number;
  upcomingServices: Array<{
    bookingId: string;
    vendorId: string;
    vendorName: string;
    title: string;
    serviceDate: string;
    eventId: string | null;
    eventName: string | null;
  }>;
}
