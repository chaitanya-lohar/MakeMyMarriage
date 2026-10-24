import { Injectable } from '@nestjs/common';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { EventsService } from '../../../events/index.js';
import { todayIn } from '../../../weddings/index.js';
import {
  TransactionRunner,
  type Transaction,
} from '../../../../infrastructure/database/transaction.js';
import type {
  Booking,
  BookingDetails,
  Vendor,
  VendorDetails,
  VendorSummary,
  VendorView,
} from '../../domain/types/vendor.js';
import { VendorsRepository } from '../../infrastructure/repositories/vendors.repository.js';
import { VendorsErrors } from '../vendors-errors.js';
@Injectable()
export class VendorsService {
  constructor(
    private readonly repo: VendorsRepository,
    private readonly events: EventsService,
    private readonly audit: AuditService,
    private readonly tx: TransactionRunner,
  ) {}
  async create(w: string, u: string, d: VendorDetails) {
    return this.tx.run(async (t) => {
      const v = await this.repo.create(w, u, d, t);
      await this.audit.record(
        {
          weddingId: w,
          actorUserId: u,
          action: AuditAction.VendorCreated,
          resourceType: 'vendor',
          resourceId: v.id,
          metadata: { name: v.name, category: v.category },
        },
        t,
      );
      return v;
    });
  }
  async list(
    w: string,
    q: {
      search?: string;
      category?: string;
      bookingStatus?: string;
      eventId?: string;
      limit: number;
      cursor?: string;
    },
  ) {
    if (q.eventId && q.eventId !== 'none') await this.events.getActive(w, q.eventId);
    const result = await this.repo.list(w, q);
    const counts = await this.repo.countsFor(
      w,
      result.vendors.map((vendor) => vendor.id),
    );
    const items = result.vendors.map((vendor) => ({
      vendor,
      bookingCounts: counts.get(vendor.id)!,
    }));
    return { ...result, items };
  }
  async get(w: string, id: string): Promise<VendorView> {
    const v = await this.repo.findActive(w, id);
    if (!v) throw VendorsErrors.notFound();
    return { vendor: v, bookingCounts: await this.repo.counts(w, id) };
  }
  async update(w: string, id: string, u: string, d: Partial<VendorDetails>) {
    return this.tx.run(async (t) => {
      const before = await this.repo.findActive(w, id, t);
      if (!before) throw VendorsErrors.notFound();
      const after = await this.repo.update(w, id, d, t);
      if (!after) throw VendorsErrors.notFound();
      const oldValue: Record<string, unknown> = {},
        newValue: Record<string, unknown> = {};
      for (const k of Object.keys(d) as Array<keyof VendorDetails>) {
        if (before[k] !== after[k]) {
          oldValue[k] = before[k];
          newValue[k] = after[k];
        }
      }
      if (Object.keys(newValue).length)
        await this.audit.record(
          {
            weddingId: w,
            actorUserId: u,
            action: AuditAction.VendorUpdated,
            resourceType: 'vendor',
            resourceId: id,
            metadata: { oldValue, newValue },
          },
          t,
        );
      return after;
    });
  }
  async delete(w: string, id: string, u: string) {
    return this.tx.run(async (t) => {
      if (!(await this.repo.findActive(w, id, t))) throw VendorsErrors.notFound();
      const active = await this.repo.activeBookings(w, id, t);
      if (active.length) throw VendorsErrors.activeBookings(active);
      if (!(await this.repo.softDelete(w, id, u, t))) throw VendorsErrors.notFound();
      await this.audit.record(
        {
          weddingId: w,
          actorUserId: u,
          action: AuditAction.VendorDeleted,
          resourceType: 'vendor',
          resourceId: id,
        },
        t,
      );
    });
  }
  async bookings(w: string, id: string): Promise<Booking[]> {
    const v = await this.repo.findActive(w, id);
    if (!v) throw VendorsErrors.notFound();
    const docs = await this.repo.bookingsFor(w, id);
    const events = await this.events.listActive(w);
    const names = new Map(events.map((e) => [e.id, e.name]));
    return docs
      .map((b) =>
        this.repo.toBooking(
          b,
          v.name,
          b.eventId ? (names.get(b.eventId.toString()) ?? null) : null,
        ),
      )
      .sort((a, b) => {
        if (!a.serviceDate && !b.serviceDate) return b.createdAt.getTime() - a.createdAt.getTime();
        if (!a.serviceDate) return 1;
        if (!b.serviceDate) return -1;
        return (
          a.serviceDate.localeCompare(b.serviceDate) ||
          b.createdAt.getTime() - a.createdAt.getTime()
        );
      });
  }
  async booking(w: string, vendorId: string, id: string) {
    const [v, b] = await Promise.all([
      this.repo.findActive(w, vendorId),
      this.repo.findBooking(w, vendorId, id),
    ]);
    if (!v) throw VendorsErrors.notFound();
    if (!b) throw VendorsErrors.bookingNotFound();
    const events = await this.events.listActive(w);
    return {
      ...b,
      vendorName: v.name,
      eventName: b.eventId ? (events.find((e) => e.id === b.eventId)?.name ?? null) : null,
    };
  }
  async createBooking(w: string, vid: string, u: string, d: BookingDetails): Promise<Booking> {
    return this.tx.run(async (t) => {
      if (!(await this.repo.claimActive(w, vid, t))) throw VendorsErrors.notFound();
      if (d.eventId) await this.events.claimActive(w, d.eventId, t);
      const v = await this.repo.findActive(w, vid, t);
      const b = await this.repo.createBooking(w, vid, u, d, t);
      await this.audit.record(
        {
          weddingId: w,
          actorUserId: u,
          action: AuditAction.VendorBookingCreated,
          resourceType: 'vendor_booking',
          resourceId: b.id,
          metadata: { vendorId: vid, title: b.title, status: b.status },
        },
        t,
      );
      const events = await this.events.listActive(w);
      return {
        ...b,
        vendorName: v?.name ?? '',
        eventName: b.eventId ? (events.find((e) => e.id === b.eventId)?.name ?? null) : null,
      };
    });
  }
  async updateBooking(
    w: string,
    vid: string,
    bid: string,
    u: string,
    d: Partial<BookingDetails>,
  ): Promise<Booking> {
    return this.tx.run(async (t) => {
      const v = await this.repo.findActive(w, vid, t);
      if (!v) throw VendorsErrors.notFound();
      const before = await this.repo.findBooking(w, vid, bid, t);
      if (!before) throw VendorsErrors.bookingNotFound();
      if (
        d.status &&
        d.status !== 'CANCELLED' &&
        before.status === 'CANCELLED' &&
        !(await this.repo.claimActive(w, vid, t))
      )
        throw VendorsErrors.notFound();
      if (d.eventId && d.eventId !== before.eventId) await this.events.claimActive(w, d.eventId, t);
      const after = await this.repo.updateBooking(w, vid, bid, d, t);
      if (!after) throw VendorsErrors.bookingNotFound();
      const fields = Object.keys(d).filter(
        (k) => before[k as keyof Booking] !== after[k as keyof Booking],
      ) as Array<keyof BookingDetails>;
      const oldValue = Object.fromEntries(fields.map((key) => [key, before[key as keyof Booking]]));
      const newValue = Object.fromEntries(fields.map((key) => [key, after[key as keyof Booking]]));
      const changed = fields.length > 0;
      if (changed)
        await this.audit.record(
          {
            weddingId: w,
            actorUserId: u,
            action:
              d.status && d.status !== before.status
                ? AuditAction.VendorBookingStatusChanged
                : AuditAction.VendorBookingUpdated,
            resourceType: 'vendor_booking',
            resourceId: bid,
            metadata: { oldValue, newValue },
          },
          t,
        );
      const events = await this.events.listActive(w);
      return {
        ...after,
        vendorName: v.name,
        eventName: after.eventId
          ? (events.find((e) => e.id === after.eventId)?.name ?? null)
          : null,
      };
    });
  }
  async lookup(w: string, id: string, tx?: Transaction) {
    return this.repo.lookup(w, id, tx);
  }
  async lookupMany(w: string, ids: string[]) {
    return this.repo.lookupMany(w, ids);
  }
  async activeVendors(w: string) {
    return this.repo.allActive(w);
  }
  async dashboard(w: string, timezone: string, now = new Date()): Promise<VendorSummary> {
    const s = await this.repo.summary(w, todayIn(timezone, now));
    const [vendors, events] = await Promise.all([
      this.repo.lookupMany(
        w,
        s.bookings.map((booking) => booking.vendorId.toString()),
      ),
      this.events.listActive(w),
    ]);
    const eventNames = new Map(events.map((e) => [e.id, e.name]));
    return {
      activeVendors: s.activeVendors,
      bookedVendors: s.bookedVendors,
      bookingsNeedingFollowUp: s.bookingsNeedingFollowUp,
      upcomingServices: s.bookings.map((b) => ({
        bookingId: b._id.toString(),
        vendorId: b.vendorId.toString(),
        vendorName: vendors.get(b.vendorId.toString())?.name ?? '',
        title: b.title,
        serviceDate: b.serviceDate!.toISOString().slice(0, 10),
        eventId: b.eventId?.toString() ?? null,
        eventName: b.eventId ? (eventNames.get(b.eventId.toString()) ?? null) : null,
      })),
    };
  }
}
