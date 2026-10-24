import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import type {
  Booking,
  BookingDetails,
  Vendor,
  VendorDetails,
  VendorCounts,
} from '../../domain/types/vendor.js';
import {
  VendorBookingRecord,
  type VendorBookingDocument,
} from '../schemas/vendor-booking.schema.js';
import { VendorRecord, type VendorDocument } from '../schemas/vendor.schema.js';
const oid = (v: string) => new Types.ObjectId(v);
const notDeleted = () => ({ deletedAt: trusted({ $exists: false }) });
const date = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : undefined);
const dateText = (v?: Date) => (v ? `${v.toISOString().slice(0, 10)}` : null);
const vendorOf = (d: VendorDocument): Vendor => ({
  id: d._id.toString(),
  weddingId: d.weddingId.toString(),
  name: d.name,
  category: d.category,
  contactPerson: d.contactPerson ?? null,
  phone: d.phone ?? null,
  email: d.email ?? null,
  address: d.address ?? null,
  website: d.website ?? null,
  notes: d.notes ?? null,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});
const bookingOf = (d: VendorBookingDocument, name: string, eventName: string | null): Booking => ({
  id: d._id.toString(),
  weddingId: d.weddingId.toString(),
  vendorId: d.vendorId.toString(),
  vendorName: name,
  title: d.title,
  status: d.status,
  bookingDate: dateText(d.bookingDate),
  serviceDate: dateText(d.serviceDate),
  eventId: d.eventId?.toString() ?? null,
  eventName,
  agreedPriceMinor: d.agreedPriceMinor ?? null,
  notes: d.notes ?? null,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});
@Injectable()
export class VendorsRepository {
  constructor(
    @InjectModel(VendorRecord.name) private readonly vendors: Model<VendorRecord>,
    @InjectModel(VendorBookingRecord.name) private readonly bookings: Model<VendorBookingRecord>,
  ) {}
  async create(
    weddingId: string,
    userId: string,
    details: VendorDetails,
    tx?: Transaction,
  ): Promise<Vendor> {
    const values = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== null));
    const [d] = await this.vendors.create(
      [{ weddingId: oid(weddingId), createdBy: oid(userId), ...values }],
      { session: sessionOf(tx) ?? null },
    );
    return vendorOf(d!);
  }
  async findActive(weddingId: string, id: string, tx?: Transaction): Promise<Vendor | null> {
    if (!isValidObjectId(id)) return null;
    const d = await this.vendors
      .findOne({ _id: oid(id), weddingId: oid(weddingId), ...notDeleted() })
      .session(sessionOf(tx) ?? null);
    return d ? vendorOf(d) : null;
  }
  async lookup(
    weddingId: string,
    id: string,
    tx?: Transaction,
  ): Promise<{ id: string; name: string; deleted: boolean } | null> {
    if (!isValidObjectId(id)) return null;
    const d = await this.vendors
      .findOne({ _id: oid(id), weddingId: oid(weddingId) })
      .select({ name: 1, deletedAt: 1 })
      .session(sessionOf(tx) ?? null);
    return d ? { id: d._id.toString(), name: d.name, deleted: !!d.deletedAt } : null;
  }
  async lookupMany(
    weddingId: string,
    ids: string[],
  ): Promise<Map<string, { id: string; name: string; deleted: boolean }>> {
    const validIds = [...new Set(ids)].filter(isValidObjectId);
    if (validIds.length === 0) return new Map();
    const documents = await this.vendors
      .find({ _id: trusted({ $in: validIds.map(oid) }), weddingId: oid(weddingId) })
      .select({ name: 1, deletedAt: 1 });
    return new Map<string, { id: string; name: string; deleted: boolean }>(
      documents.map((document): [string, { id: string; name: string; deleted: boolean }] => [
        document._id.toString(),
        { id: document._id.toString(), name: document.name, deleted: !!document.deletedAt },
      ]),
    );
  }
  async update(
    weddingId: string,
    id: string,
    changes: Partial<VendorDetails>,
    tx?: Transaction,
  ): Promise<Vendor | null> {
    const set = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== null));
    const unset = Object.fromEntries(
      Object.entries(changes)
        .filter(([, v]) => v === null)
        .map(([k]) => [k, 1]),
    );
    const update = {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    };
    const d = await this.vendors.findOneAndUpdate(
      { _id: oid(id), weddingId: oid(weddingId), ...notDeleted() },
      update,
      { new: true, session: sessionOf(tx) ?? null },
    );
    return d ? vendorOf(d) : null;
  }
  async claimActive(weddingId: string, id: string, tx: Transaction): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    return !!(await this.vendors.findOneAndUpdate(
      { _id: oid(id), weddingId: oid(weddingId), ...notDeleted() },
      { $inc: { __v: 1 } },
      { new: true, timestamps: false, session: sessionOf(tx) ?? null },
    ));
  }
  async softDelete(
    weddingId: string,
    id: string,
    userId: string,
    tx: Transaction,
  ): Promise<boolean> {
    return !!(await this.vendors.findOneAndUpdate(
      { _id: oid(id), weddingId: oid(weddingId), ...notDeleted() },
      { $set: { deletedAt: new Date(), deletedBy: oid(userId) } },
      { new: true, session: sessionOf(tx) ?? null },
    ));
  }
  async createBooking(
    weddingId: string,
    vendorId: string,
    userId: string,
    d: BookingDetails,
    tx: Transaction,
  ): Promise<Booking> {
    const [b] = await this.bookings.create(
      [
        {
          weddingId: oid(weddingId),
          vendorId: oid(vendorId),
          createdBy: oid(userId),
          title: d.title,
          status: d.status,
          bookingDate: date(d.bookingDate),
          serviceDate: date(d.serviceDate),
          ...(d.eventId ? { eventId: oid(d.eventId) } : {}),
          ...(d.agreedPriceMinor === null ? {} : { agreedPriceMinor: d.agreedPriceMinor }),
          ...(d.notes === null ? {} : { notes: d.notes }),
        },
      ],
      { session: sessionOf(tx) ?? null },
    );
    return bookingOf(b!, '', null);
  }
  async findBooking(
    weddingId: string,
    vendorId: string,
    id: string,
    tx?: Transaction,
  ): Promise<Booking | null> {
    if (!isValidObjectId(id)) return null;
    const b = await this.bookings
      .findOne({ _id: oid(id), weddingId: oid(weddingId), vendorId: oid(vendorId) })
      .session(sessionOf(tx) ?? null);
    return b ? bookingOf(b, '', null) : null;
  }
  async updateBooking(
    weddingId: string,
    vendorId: string,
    id: string,
    d: Partial<BookingDetails>,
    tx: Transaction,
  ): Promise<Booking | null> {
    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    if (d.title !== undefined) set.title = d.title;
    if (d.status !== undefined) set.status = d.status;
    if (d.bookingDate !== undefined) {
      if (d.bookingDate === null) unset.bookingDate = 1;
      else set.bookingDate = date(d.bookingDate);
    }
    if (d.serviceDate !== undefined) {
      if (d.serviceDate === null) unset.serviceDate = 1;
      else set.serviceDate = date(d.serviceDate);
    }
    if (d.eventId !== undefined) {
      if (d.eventId === null) unset.eventId = 1;
      else set.eventId = oid(d.eventId);
    }
    if (d.agreedPriceMinor !== undefined) {
      if (d.agreedPriceMinor === null) unset.agreedPriceMinor = 1;
      else set.agreedPriceMinor = d.agreedPriceMinor;
    }
    if (d.notes !== undefined) {
      if (d.notes === null) unset.notes = 1;
      else set.notes = d.notes;
    }
    const b = await this.bookings.findOneAndUpdate(
      { _id: oid(id), weddingId: oid(weddingId), vendorId: oid(vendorId) },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true, session: sessionOf(tx) ?? null },
    );
    return b ? bookingOf(b, '', null) : null;
  }
  async bookingsFor(
    weddingId: string,
    vendorId: string,
    tx?: Transaction,
  ): Promise<VendorBookingDocument[]> {
    return this.bookings
      .find({ weddingId: oid(weddingId), vendorId: oid(vendorId) })
      .sort({ serviceDate: 1, createdAt: -1, _id: 1 })
      .session(sessionOf(tx) ?? null);
  }
  async activeBookings(
    weddingId: string,
    vendorId: string,
    tx?: Transaction,
  ): Promise<
    Array<{ id: string; title: string; status: string; agreedPriceMinor: number | null }>
  > {
    const bs = await this.bookings
      .find({
        weddingId: oid(weddingId),
        vendorId: oid(vendorId),
        status: trusted({ $ne: 'CANCELLED' }),
      })
      .sort({ createdAt: 1 })
      .session(sessionOf(tx) ?? null);
    return bs.map((b) => ({
      id: b._id.toString(),
      title: b.title,
      status: b.status,
      agreedPriceMinor: b.agreedPriceMinor ?? null,
    }));
  }
  async unlinkEvent(
    weddingId: string,
    eventId: string,
    tx: Transaction,
  ): Promise<VendorBookingDocument[]> {
    const bs = await this.bookings
      .find({ weddingId: oid(weddingId), eventId: oid(eventId) })
      .session(sessionOf(tx) ?? null);
    if (bs.length)
      await this.bookings.updateMany(
        { weddingId: oid(weddingId), eventId: oid(eventId) },
        { $unset: { eventId: 1 } },
        { session: sessionOf(tx)! },
      );
    return bs;
  }
  async counts(weddingId: string, vendorId: string): Promise<VendorCounts> {
    const rows = await this.bookings.aggregate<{ _id: string; count: number }>([
      { $match: { weddingId: oid(weddingId), vendorId: oid(vendorId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const c = new Map(rows.map((x) => [x._id, x.count]));
    return {
      booked: c.get('BOOKED') ?? 0,
      inProgress: ['NOT_CONTACTED', 'CONTACTED', 'QUOTATION_RECEIVED', 'NEGOTIATING'].reduce(
        (s, k) => s + (c.get(k) ?? 0),
        0,
      ),
      cancelled: c.get('CANCELLED') ?? 0,
    };
  }
  async countsFor(weddingId: string, vendorIds: string[]): Promise<Map<string, VendorCounts>> {
    if (vendorIds.length === 0) return new Map();
    const rows = await this.bookings.aggregate<{
      _id: { vendorId: Types.ObjectId; status: string };
      count: number;
    }>([
      {
        $match: {
          weddingId: oid(weddingId),
          vendorId: trusted({ $in: vendorIds.map(oid) }),
        },
      },
      { $group: { _id: { vendorId: '$vendorId', status: '$status' }, count: { $sum: 1 } } },
    ]);
    const totals = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const id = row._id.vendorId.toString();
      const counts = totals.get(id) ?? new Map<string, number>();
      counts.set(row._id.status, row.count);
      totals.set(id, counts);
    }
    return new Map<string, VendorCounts>(
      vendorIds.map((id): [string, VendorCounts] => {
        const counts = totals.get(id) ?? new Map<string, number>();
        return [
          id,
          {
            booked: counts.get('BOOKED') ?? 0,
            inProgress: ['NOT_CONTACTED', 'CONTACTED', 'QUOTATION_RECEIVED', 'NEGOTIATING'].reduce(
              (sum, status) => sum + (counts.get(status) ?? 0),
              0,
            ),
            cancelled: counts.get('CANCELLED') ?? 0,
          },
        ];
      }),
    );
  }
  async list(
    weddingId: string,
    query: {
      search?: string;
      category?: string;
      bookingStatus?: string;
      eventId?: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<{ vendors: Vendor[]; nextCursor: string | null }> {
    const match: Record<string, unknown> = { weddingId: oid(weddingId), ...notDeleted() };
    if (query.category) match.category = query.category;
    if (query.search)
      match.name = trusted({
        $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      });
    if (query.bookingStatus || query.eventId) {
      const b: Record<string, unknown> = { weddingId: oid(weddingId) };
      if (query.bookingStatus) b.status = query.bookingStatus;
      if (query.eventId)
        b.eventId = query.eventId === 'none' ? trusted({ $exists: false }) : oid(query.eventId);
      const ids = await this.bookings.distinct('vendorId', b);
      match._id = trusted({ $in: ids });
    }
    if (query.cursor) {
      try {
        const [name, id] = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()) as [
          string,
          string,
        ];
        if (isValidObjectId(id))
          match.$or = [{ name: trusted({ $gt: name }) }, { name, _id: trusted({ $gt: oid(id) }) }];
      } catch {}
    }
    const docs = await this.vendors
      .find(match)
      .collation({ locale: 'en', strength: 2 })
      .sort({ name: 1, _id: 1 })
      .limit(query.limit + 1);
    const more = docs.length > query.limit;
    const page = docs.slice(0, query.limit);
    const last = page.at(-1);
    return {
      vendors: page.map(vendorOf),
      nextCursor:
        more && last
          ? Buffer.from(JSON.stringify([last.name, last._id.toString()])).toString('base64url')
          : null,
    };
  }
  async summary(
    weddingId: string,
    today: string,
  ): Promise<{
    activeVendors: number;
    bookedVendors: number;
    bookingsNeedingFollowUp: number;
    bookings: VendorBookingDocument[];
  }> {
    const wid = oid(weddingId);
    const activeIds = (await this.vendors.distinct('_id', {
      weddingId: wid,
      ...notDeleted(),
    })) as Types.ObjectId[];
    const [activeVendors, bookedIds, bookingsNeedingFollowUp, bookings] = await Promise.all([
      this.vendors.countDocuments({ weddingId: wid, ...notDeleted() }),
      this.bookings.distinct('vendorId', { weddingId: wid, status: 'BOOKED' }),
      this.bookings.countDocuments({
        weddingId: wid,
        status: trusted({ $in: ['NOT_CONTACTED', 'CONTACTED', 'NEGOTIATING'] }),
        vendorId: trusted({ $in: activeIds }),
      }),
      this.bookings
        .find({
          weddingId: wid,
          status: 'BOOKED',
          serviceDate: trusted({ $gte: new Date(`${today}T00:00:00.000Z`) }),
        })
        .sort({ serviceDate: 1, createdAt: 1 })
        .limit(5),
    ]);
    const activeSet = new Set(activeIds.map((id) => id.toString()));
    const bookedVendors = (bookedIds as Types.ObjectId[]).filter((id) =>
      activeSet.has(id.toString()),
    ).length;
    return { activeVendors, bookedVendors, bookingsNeedingFollowUp, bookings };
  }
  async allActive(weddingId: string): Promise<Vendor[]> {
    return (
      await this.vendors
        .find({ weddingId: oid(weddingId), ...notDeleted() })
        .sort({ name: 1, _id: 1 })
        .collation({ locale: 'en', strength: 2 })
    ).map(vendorOf);
  }
  toBooking(d: VendorBookingDocument, name: string, eventName: string | null): Booking {
    return bookingOf(d, name, eventName);
  }
}
