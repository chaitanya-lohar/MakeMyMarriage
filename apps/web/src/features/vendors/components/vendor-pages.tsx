'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, PrimaryButton, SecondaryButton, controlClasses } from '@/components/ui/form';
import {
  RequireWedding,
  PageHeader,
  PrimaryLink,
  SkeletonCard,
  Can,
} from '@/features/workspace/components/workspace-page';
import { VENDORS_PATH } from '@/features/workspace/components/shell-parts';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import type { ApiExpense } from '@/features/expenses/expense-model';
import { formatRupees } from '@/features/expenses/money';
import { StatusTag } from '@/features/expenses/components/expense-parts';
import { api, call } from '@/lib/api';
import {
  vendorCategories as cats,
  bookingStatusLabels as statuses,
  vendorCopy as copy,
} from '../content';
import {
  bookingStatuses,
  categories,
  formatVendorDate,
  rupeesFromMinor,
  type ApiVendor,
  type ApiVendorView,
  type ApiBooking,
} from '../vendor-model';

export function VendorsPageContent() {
  return (
    <RequireWedding permission={['VENDORS', 'VIEW']}>
      {(w) => <VendorsList wedding={w} />}
    </RequireWedding>
  );
}
export function NewVendorPageContent() {
  return (
    <RequireWedding permission={['VENDORS', 'CREATE']}>
      {(w) => <VendorForm wedding={w} />}
    </RequireWedding>
  );
}
export function VendorPageContent({ vendorId }: { vendorId: string }) {
  return (
    <RequireWedding permission={['VENDORS', 'VIEW']}>
      {(w) => <VendorDetail wedding={w} vendorId={vendorId} />}
    </RequireWedding>
  );
}
export function EditVendorPageContent({ vendorId }: { vendorId: string }) {
  return (
    <RequireWedding permission={['VENDORS', 'EDIT']}>
      {(w) => <VendorForm wedding={w} vendorId={vendorId} />}
    </RequireWedding>
  );
}
function VendorsList({ wedding }: { wedding: ApiWedding }) {
  const [rows, setRows] = useState<ApiVendorView[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [state, setState] = useState('loading'),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [bookingStatus, setStatus] = useState(''),
    [eventId, setEvent] = useState(''),
    [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const requestSequence = useRef(0);
  const load = useCallback(
    async (next = false, pageCursor: string | null = null) => {
      const request = ++requestSequence.current;
      const result = await api.GET('/api/v1/weddings/{weddingId}/vendors', {
        params: {
          path: { weddingId: wedding.id },
          query: {
            limit: 25,
            ...(search ? { search } : {}),
            ...(category ? { category: category as ApiVendor['category'] } : {}),
            ...(bookingStatus ? { bookingStatus: bookingStatus as ApiBooking['status'] } : {}),
            ...(eventId ? { eventId } : {}),
            ...(next && pageCursor ? { cursor: pageCursor } : {}),
          },
        },
      });
      if (request !== requestSequence.current) return;
      if (result.data) {
        const page = result.data.data as ApiVendorView[];
        setRows((old) => (next ? [...old, ...page] : page));
        setCursor(result.data.meta.pagination.nextCursor);
        setState('ready');
      } else setState('error');
    },
    [wedding.id, search, category, bookingStatus, eventId],
  );
  useEffect(() => {
    requestSequence.current++;
    const timeout = window.setTimeout(() => {
      setState('loading');
      void load();
    });
    return () => window.clearTimeout(timeout);
  }, [load]);
  useEffect(() => {
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((r) => {
      if (r.data) setEvents(r.data.map((e) => ({ id: e.id, name: e.name })));
    });
  }, [wedding.id]);
  const isFiltered = Boolean(search || category || bookingStatus || eventId);
  return (
    <>
      <PageHeader
        title={copy.listTitle}
        actions={
          <Can module="VENDORS" action="CREATE">
            <PrimaryLink href={`${VENDORS_PATH}/new`}>{copy.add}</PrimaryLink>
          </Can>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className={controlClasses}
          aria-label={copy.search}
          placeholder={copy.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={controlClasses}
          aria-label={copy.category}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{copy.allCategories}</option>
          {categories.map((x) => (
            <option key={x} value={x}>
              {cats[x]}
            </option>
          ))}
        </select>
        <select
          className={controlClasses}
          aria-label={copy.status}
          value={bookingStatus}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{copy.allStatuses}</option>
          {bookingStatuses.map((x) => (
            <option key={x} value={x}>
              {statuses[x]}
            </option>
          ))}
        </select>
        <select
          className={controlClasses}
          aria-label={copy.event}
          value={eventId}
          onChange={(e) => setEvent(e.target.value)}
        >
          <option value="">{copy.allEvents}</option>
          <option value="none">{copy.wholeWedding}</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      {state === 'loading' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : state === 'error' ? (
        <div className="space-y-3">
          <Banner tone="error" icon="error">
            {copy.loadingError}
          </Banner>
          <SecondaryButton icon="refresh" onClick={() => void load()}>
            {copy.retry}
          </SecondaryButton>
        </div>
      ) : rows.length === 0 ? (
        <section className="rounded-2xl border border-hairline bg-white p-8 text-center">
          <h2 className="font-serif text-title-lg text-navy">
            {isFiltered ? copy.noMatches : copy.emptyTitle}
          </h2>
          {!isFiltered && (
            <>
              <p className="mt-2 text-on-surface-variant">{copy.emptyBody}</p>
              <div className="mt-5">
                <Can module="VENDORS" action="CREATE">
                  <PrimaryLink href={`${VENDORS_PATH}/new`}>{copy.add}</PrimaryLink>
                </Can>
              </div>
            </>
          )}
        </section>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((v) => (
              <Link
                key={v.id}
                href={`${VENDORS_PATH}/${v.id}`}
                className="rounded-2xl border border-hairline bg-white p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-secondary"
              >
                <h2 className="font-serif text-title-lg text-navy">{v.name}</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">{cats[v.category]}</p>
                <p className="mt-3 text-body-sm text-on-surface-variant">
                  {v.bookingCounts.booked + v.bookingCounts.inProgress === 0 ? (
                    copy.noBookings
                  ) : (
                    <>
                      {v.bookingCounts.booked} {copy.countBooked}
                      {copy.bookingCountSeparator}
                      {v.bookingCounts.inProgress} {copy.countInProgress}
                    </>
                  )}
                </p>
              </Link>
            ))}
          </div>
          {cursor && (
            <div className="mt-6 text-center">
              <SecondaryButton onClick={() => void load(true, cursor)}>
                {copy.loadMore}
              </SecondaryButton>
            </div>
          )}
        </>
      )}
    </>
  );
}

function VendorForm({ wedding, vendorId }: { wedding: ApiWedding; vendorId?: string }) {
  const router = useRouter(),
    [message, setMessage] = useState('');
  const [values, setValues] = useState({
    name: '',
    category: 'VENUE' as ApiVendor['category'],
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    notes: '',
  });
  useEffect(() => {
    if (!vendorId) return;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/vendors/{vendorId}', {
        params: { path: { weddingId: wedding.id, vendorId } },
      }),
    ).then((r) => {
      if (r.data) {
        const v = r.data as ApiVendor;
        setValues({
          name: v.name,
          category: v.category,
          contactPerson: v.contactPerson ?? '',
          phone: v.phone ?? '',
          email: v.email ?? '',
          address: v.address ?? '',
          website: v.website ?? '',
          notes: v.notes ?? '',
        });
      } else setMessage(copy.loadVendorError);
    });
  }, [wedding.id, vendorId]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const body = {
      ...values,
      contactPerson: values.contactPerson || null,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      website: values.website || null,
      notes: values.notes || null,
    };
    const r = vendorId
      ? await call(() =>
          api.PATCH('/api/v1/weddings/{weddingId}/vendors/{vendorId}', {
            params: { path: { weddingId: wedding.id, vendorId } },
            body,
          }),
        )
      : await call(() =>
          api.POST('/api/v1/weddings/{weddingId}/vendors', {
            params: { path: { weddingId: wedding.id } },
            body,
          }),
        );
    if (r.data) router.push(vendorId ? `${VENDORS_PATH}/${vendorId}` : VENDORS_PATH);
    else setMessage(r.error.message);
  };
  return (
    <>
      <PageHeader
        title={vendorId ? copy.editVendor : copy.add}
        back={{ href: vendorId ? `${VENDORS_PATH}/${vendorId}` : VENDORS_PATH, label: 'Vendors' }}
      />
      <form
        onSubmit={(event) => {
          void save(event);
        }}
        className="max-w-3xl space-y-5 rounded-2xl border border-hairline bg-white p-5 sm:p-8"
      >
        {message && (
          <Banner tone="error" icon="error">
            {message}
          </Banner>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={copy.name}
            value={values.name}
            onChange={(name) => setValues({ ...values, name })}
            required
          />
          <label className="block text-label-md text-navy">
            {copy.categoryLabel}
            <select
              className={`${controlClasses} mt-1`}
              value={values.category}
              onChange={(e) =>
                setValues({ ...values, category: e.target.value as ApiVendor['category'] })
              }
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {cats[c]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={copy.contact}
            value={values.contactPerson}
            onChange={(contactPerson) => setValues({ ...values, contactPerson })}
          />
          <Field
            label={copy.phone}
            value={values.phone}
            onChange={(phone) => setValues({ ...values, phone })}
          />
          <Field
            label={copy.email}
            value={values.email}
            onChange={(email) => setValues({ ...values, email })}
            type="email"
          />
          <Field
            label={copy.website}
            value={values.website}
            onChange={(website) => setValues({ ...values, website })}
            type="url"
          />
          <Field
            label={copy.address}
            value={values.address}
            onChange={(address) => setValues({ ...values, address })}
          />
          <label className="block text-label-md text-navy sm:col-span-2">
            {copy.notes}
            <textarea
              className={`${controlClasses} mt-1`}
              rows={4}
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </label>
        </div>
        <PrimaryButton type="submit">{copy.save}</PrimaryButton>
      </form>
    </>
  );
}
function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-label-md text-navy">
      {label}
      <input
        className={`${controlClasses} mt-1`}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function VendorDetail({ wedding, vendorId }: { wedding: ApiWedding; vendorId: string }) {
  const router = useRouter();
  const [vendor, setVendor] = useState<ApiVendor | null>(null),
    [bookings, setBookings] = useState<ApiBooking[]>([]),
    [expenses, setExpenses] = useState<ApiExpense[]>([]),
    [events, setEvents] = useState<Array<{ id: string; name: string }>>([]),
    [state, setState] = useState('loading'),
    [dialog, setDialog] = useState(false),
    [editingBooking, setEditingBooking] = useState<ApiBooking | null>(null),
    [deleteDialog, setDeleteDialog] = useState(false),
    [refused, setRefused] = useState<ApiBooking[]>([]),
    [toast, setToast] = useState('');
  const refresh = useCallback(() => {
    const linkedExpenses = async () => {
      const all: ApiExpense[] = [];
      let cursor: string | null = null;
      do {
        const response = await api.GET('/api/v1/weddings/{weddingId}/expenses', {
          params: {
            path: { weddingId: wedding.id },
            query: { vendorId, limit: 100, ...(cursor ? { cursor } : {}) },
          },
        });
        if (response.error || !response.data) return null;
        const payload = response.data as unknown as {
          data: ApiExpense[];
          meta: { pagination: { nextCursor: string | null } };
        };
        all.push(...payload.data);
        cursor = payload.meta.pagination.nextCursor;
      } while (cursor);
      return all;
    };
    void Promise.all([
      call(() =>
        api.GET('/api/v1/weddings/{weddingId}/vendors/{vendorId}', {
          params: { path: { weddingId: wedding.id, vendorId } },
        }),
      ),
      call(() =>
        api.GET('/api/v1/weddings/{weddingId}/vendors/{vendorId}/bookings', {
          params: { path: { weddingId: wedding.id, vendorId } },
        }),
      ),
      linkedExpenses(),
    ]).then(([v, b, e]) => {
      if (v.data && b.data && e) {
        setVendor(v.data);
        setBookings(b.data);
        setExpenses(e);
        setState('ready');
      } else setState('error');
    });
  }, [wedding.id, vendorId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((r) => {
      if (r.data) setEvents(r.data.map((e) => ({ id: e.id, name: e.name })));
    });
  }, [wedding.id]);
  const cancel = async (b: ApiBooking) => {
    const r = await call(() =>
      api.PATCH('/api/v1/weddings/{weddingId}/vendors/{vendorId}/bookings/{bookingId}', {
        params: { path: { weddingId: wedding.id, vendorId, bookingId: b.id } },
        body: { status: 'CANCELLED' },
      }),
    );
    if (r.data) {
      setToast(copy.cancelled);
      refresh();
    }
  };
  const remove = async () => {
    const r = await api.DELETE('/api/v1/weddings/{weddingId}/vendors/{vendorId}', {
      params: { path: { weddingId: wedding.id, vendorId } },
    });
    if (!r.error && r.response.status === 204) router.push(VENDORS_PATH);
    else if (r.response.status === 409) {
      const activeBookings = (
        r.error as { error?: { details?: { activeBookings?: ApiBooking[] } } } | undefined
      )?.error?.details?.activeBookings;
      setRefused(activeBookings ?? bookings.filter((b) => b.status !== 'CANCELLED'));
      setDeleteDialog(false);
      setRefusedDialog(true);
    } else setToast(copy.deleteError);
  };
  const [refusedDialog, setRefusedDialog] = useState(false);
  if (state === 'loading') return <SkeletonCard className="h-64" />;
  if (state === 'error' || !vendor)
    return (
      <Banner tone="error" icon="error">
        {copy.unableToLoad}
      </Banner>
    );
  return (
    <>
      <PageHeader
        title={vendor.name}
        back={{ href: VENDORS_PATH, label: copy.listTitle }}
        actions={
          <>
            <Can module="VENDORS" action="EDIT">
              <SecondaryButton onClick={() => router.push(`${VENDORS_PATH}/${vendorId}/edit`)}>
                {copy.edit}
              </SecondaryButton>
            </Can>
            <Can module="VENDORS" action="DELETE">
              <SecondaryButton onClick={() => setDeleteDialog(true)}>{copy.delete}</SecondaryButton>
            </Can>
            <Can module="VENDORS" action="CREATE">
              <PrimaryButton
                onClick={() => {
                  setEditingBooking(null);
                  setDialog(true);
                }}
              >
                {copy.addBooking}
              </PrimaryButton>
            </Can>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className="rounded-2xl border border-hairline bg-white p-5 sm:p-7">
          <h2 className="font-serif text-title-lg text-navy">{copy.bookings}</h2>
          {bookings.length === 0 ? (
            <p className="mt-4 text-body-sm text-on-surface-variant">{copy.noBookings}</p>
          ) : (
            <div className="mt-3 divide-y divide-hairline">
              {bookings.map((b) => (
                <article
                  key={b.id}
                  className={`py-4 ${b.status === 'CANCELLED' ? 'opacity-60' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-navy">{b.title}</h3>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        {statuses[b.status]} · {b.eventName ?? copy.wholeWedding}
                      </p>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        {copy.bookingDate}: {formatVendorDate(b.bookingDate)} · {copy.serviceDate}:{' '}
                        {formatVendorDate(b.serviceDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-navy">
                        {rupeesFromMinor(b.agreedPriceMinor)}
                      </p>
                      <Can module="VENDORS" action="EDIT">
                        {b.status === 'CANCELLED' ? (
                          <button
                            className="mt-2 text-label-md text-secondary underline"
                            onClick={() => {
                              setEditingBooking(b);
                              setDialog(true);
                            }}
                          >
                            {copy.reopen}
                          </button>
                        ) : (
                          <>
                            <button
                              className="mt-2 text-label-md text-navy underline"
                              onClick={() => {
                                setEditingBooking(b);
                                setDialog(true);
                              }}
                            >
                              {copy.editBooking}
                            </button>
                            <button
                              className="mt-2 block text-label-md text-on-surface-variant underline"
                              onClick={() => void cancel(b)}
                            >
                              {copy.cancel}
                            </button>
                          </>
                        )}
                      </Can>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-hairline bg-white p-5 sm:p-7 lg:col-span-2">
          <h2 className="font-serif text-title-lg text-navy">{copy.linkedExpenses}</h2>
          {expenses.length === 0 ? (
            <p className="mt-3 text-body-sm text-on-surface-variant">{copy.noExpenses}</p>
          ) : (
            <div className="mt-3 divide-y divide-hairline">
              {expenses.map((expense) => (
                <Link
                  key={expense.id}
                  href={`/expenses/${expense.id}`}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="font-medium text-navy underline">{expense.title}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-navy">
                      {formatRupees(expense.amountMinor)}
                    </span>
                    <StatusTag status={expense.paymentStatus} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside className="rounded-2xl border border-hairline bg-white p-5 sm:p-7">
          <h2 className="font-serif text-title-lg text-navy">{copy.contactTitle}</h2>
          <dl className="mt-4 space-y-3 text-body-sm">
            <Info label={copy.contact} value={vendor.contactPerson} />
            <Info label={copy.phone} value={vendor.phone} />
            <Info label={copy.email} value={vendor.email} />
            <Info label={copy.address} value={vendor.address} />
            <Info label={copy.website} value={vendor.website} />
          </dl>
          {vendor.notes && (
            <p className="mt-5 border-t border-hairline pt-4 text-body-sm text-on-surface-variant">
              {vendor.notes}
            </p>
          )}
        </aside>
      </div>
      {dialog && (
        <BookingDialog
          wedding={wedding}
          vendorId={vendorId}
          events={events}
          booking={editingBooking ?? undefined}
          onClose={() => setDialog(false)}
          onSaved={() => {
            setDialog(false);
            setEditingBooking(null);
            refresh();
          }}
        />
      )}
      {deleteDialog && (
        <Dialog title={copy.deleteConfirm} onClose={() => setDeleteDialog(false)}>
          <p className="mb-5 text-body-sm text-on-surface-variant">{copy.deleteExplanation}</p>
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={() => setDeleteDialog(false)}>
              {copy.keepVendor}
            </SecondaryButton>
            <PrimaryButton onClick={() => void remove()}>{copy.delete}</PrimaryButton>
          </div>
        </Dialog>
      )}
      {refusedDialog && (
        <Dialog title={copy.deleteRefused} onClose={() => setRefusedDialog(false)}>
          {refused.map((b) => (
            <p key={b.id} className="border-b border-hairline py-2 text-body-sm">
              {b.title} · {rupeesFromMinor(b.agreedPriceMinor)} · {statuses[b.status]}
            </p>
          ))}
          <div className="mt-5 text-right">
            <PrimaryButton onClick={() => setRefusedDialog(false)}>{copy.ok}</PrimaryButton>
          </div>
        </Dialog>
      )}
      {toast && (
        <div
          role="status"
          className="fixed right-4 bottom-4 rounded-lg bg-navy px-4 py-3 text-white"
        >
          {toast}
          <button className="ml-4" onClick={() => setToast('')} aria-label={copy.dismiss}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
function Info({ label, value }: { label: string; value: string | null }) {
  return value ? (
    <div>
      <dt className="font-medium text-navy">{label}</dt>
      <dd className="break-words text-on-surface-variant">{value}</dd>
    </div>
  ) : null;
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-5 font-serif text-title-lg text-navy">{title}</h2>
        {children}
      </section>
    </div>
  );
}
export function EventVendorBookingShortcut({
  wedding,
  eventId,
}: {
  wedding: ApiWedding;
  eventId: string;
}) {
  const [vendors, setVendors] = useState<ApiVendor[]>([]),
    [loaded, setLoaded] = useState(false),
    [open, setOpen] = useState(false),
    [events, setEvents] = useState<Array<{ id: string; name: string }>>([]),
    [saved, setSaved] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void (async () => {
      const all: ApiVendor[] = [];
      let cursor: string | null = null;
      do {
        const r = await api.GET('/api/v1/weddings/{weddingId}/vendors', {
          params: {
            path: { weddingId: wedding.id },
            query: { limit: 25, ...(cursor ? { cursor } : {}) },
          },
        });
        if (r.error || !r.data) break;
        const page = r.data as unknown as {
          data: ApiVendor[];
          meta: { pagination: { nextCursor: string | null } };
        };
        all.push(...page.data);
        cursor = page.meta.pagination.nextCursor;
      } while (cursor);
      if (active) {
        setVendors(all);
        setLoaded(true);
      }
    })();
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((r) => {
      if (active && r.data) setEvents(r.data.map((event) => ({ id: event.id, name: event.name })));
    });
    return () => {
      active = false;
    };
  }, [wedding.id]);
  return (
    <section className="mb-6 rounded-xl border border-hairline bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-title-md text-navy">{copy.vendorBooking}</h2>
        <PrimaryButton onClick={() => setOpen(true)}>{copy.addBooking}</PrimaryButton>
      </div>
      {loaded && vendors.length === 0 && (
        <div className="mt-3 rounded-lg bg-surface-container-low p-4">
          <p className="text-body-sm text-on-surface-variant">{copy.noVendors}</p>
          <Link
            className="mt-2 inline-flex min-h-11 items-center text-label-md text-navy underline"
            href={`${VENDORS_PATH}/new`}
          >
            {copy.addVendor}
          </Link>
        </div>
      )}
      {open && (
        <BookingDialog
          wedding={wedding}
          vendors={vendors}
          events={events}
          eventId={eventId}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setSaved(true);
            router.refresh();
          }}
        />
      )}
      {saved && (
        <p role="status" className="text-tertiary mt-3 text-body-sm">
          {copy.bookingSaved}
        </p>
      )}
    </section>
  );
}

function BookingDialog({
  wedding,
  vendorId,
  vendors = [],
  events,
  eventId,
  booking,
  onClose,
  onSaved,
}: {
  wedding: ApiWedding;
  vendorId?: string;
  vendors?: ApiVendor[];
  events: Array<{ id: string; name: string }>;
  eventId?: string;
  booking?: ApiBooking;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState(''),
    [selectedVendorId, setSelectedVendorId] = useState(vendorId ?? '');
  const [form, setForm] = useState({
    title: booking?.title ?? '',
    status: booking?.status ?? 'NOT_CONTACTED',
    bookingDate: booking?.bookingDate ?? '',
    serviceDate: booking?.serviceDate ?? '',
    eventId: booking?.eventId ?? eventId ?? '',
    agreedPriceMinor:
      booking?.agreedPriceMinor === null || booking?.agreedPriceMinor === undefined
        ? ''
        : String(booking.agreedPriceMinor / 100),
    notes: booking?.notes ?? '',
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) {
      setError(copy.chooseVendorError);
      return;
    }
    const priceText = form.agreedPriceMinor.trim();
    let agreedPriceMinor: number | null = null;
    if (priceText) {
      if (!/^\d+(?:\.\d{1,2})?$/.test(priceText)) {
        setError(copy.invalidPrice);
        return;
      }
      agreedPriceMinor = Number(priceText) * 100;
      if (
        !Number.isSafeInteger(agreedPriceMinor) ||
        agreedPriceMinor < 1 ||
        agreedPriceMinor > 10_000_000_000
      ) {
        setError(copy.invalidPrice);
        return;
      }
    }
    const body = {
      title: form.title,
      status: form.status,
      bookingDate: form.bookingDate || null,
      serviceDate: form.serviceDate || null,
      eventId: form.eventId || null,
      agreedPriceMinor,
      notes: form.notes || null,
    };
    const r = booking
      ? await call(() =>
          api.PATCH('/api/v1/weddings/{weddingId}/vendors/{vendorId}/bookings/{bookingId}', {
            params: {
              path: { weddingId: wedding.id, vendorId: selectedVendorId, bookingId: booking.id },
            },
            body,
          }),
        )
      : await call(() =>
          api.POST('/api/v1/weddings/{weddingId}/vendors/{vendorId}/bookings', {
            params: { path: { weddingId: wedding.id, vendorId: selectedVendorId } },
            body,
          }),
        );
    if (r.data) onSaved();
    else setError(r.error.message);
  };
  return (
    <Dialog title={booking ? copy.reopen : copy.addBooking} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          void save(event);
        }}
      >
        {booking?.status === 'CANCELLED' && (
          <Banner tone="info" icon="info">
            {copy.cancelledBanner}
          </Banner>
        )}
        {error && (
          <Banner tone="error" icon="error">
            {error}
          </Banner>
        )}
        {!vendorId && (
          <label className="block text-label-md text-navy">
            {copy.vendorLabel}
            <select
              required
              className={`${controlClasses} mt-1`}
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
            >
              <option value="">{vendors.length ? copy.chooseVendor : copy.noVendors}</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Field
          label={copy.title}
          value={form.title}
          onChange={(title) => setForm({ ...form, title })}
          required
        />
        <label className="block text-label-md text-navy">
          {copy.statusLabel}
          <select
            className={`${controlClasses} mt-1`}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ApiBooking['status'] })}
          >
            {bookingStatuses.map((s) => (
              <option key={s} value={s}>
                {statuses[s]}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={copy.bookingDate}
          type="date"
          value={form.bookingDate}
          onChange={(bookingDate) => setForm({ ...form, bookingDate })}
        />
        <Field
          label={copy.serviceDate}
          type="date"
          value={form.serviceDate}
          onChange={(serviceDate) => setForm({ ...form, serviceDate })}
        />
        <label className="block text-label-md text-navy">
          {copy.eventLabel}
          <select
            className={`${controlClasses} mt-1`}
            value={form.eventId}
            onChange={(e) => setForm({ ...form, eventId: e.target.value })}
          >
            <option value="">{copy.wholeWedding}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
            {eventId && !events.some((e) => e.id === eventId) && (
              <option value={eventId}>{copy.selectedEvent}</option>
            )}
          </select>
        </label>
        <Field
          label={copy.agreedPrice}
          value={form.agreedPriceMinor}
          onChange={(agreedPriceMinor) => setForm({ ...form, agreedPriceMinor })}
        />
        <label className="block text-label-md text-navy">
          {copy.notes}
          <textarea
            className={`${controlClasses} mt-1`}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>{copy.close}</SecondaryButton>
          <PrimaryButton type="submit">{copy.saveBooking}</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
