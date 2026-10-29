'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { Banner, controlClasses, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import type { ApiEvent } from '@/features/events/event-model';
import { NotAvailable } from '@/features/weddings/components/not-available';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { GUESTS_PATH } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  PrimaryLink,
  SkeletonCard,
  useOneOffNotice,
  Can,
} from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH } from '@/features/workspace/workspace-context';
import { api, call, toApiError, type ApiError } from '@/lib/api';
import { guestsPage, invitationPanel, linkRevoked, rsvpLabels } from '../content';
import {
  emailStatusLabel,
  formatDateTime,
  RSVP_STATUSES,
  type ApiGuest,
  type RsvpStatus,
} from '../guest-model';

const PAGE_SIZE = 25;

interface Page {
  guests: ApiGuest[];
  nextCursor: string | null;
}

interface Filters {
  search: string;
  eventId: string;
  rsvpStatus: RsvpStatus | '';
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'gone' }
  | { status: 'ready'; guests: ApiGuest[]; nextCursor: string | null };

/** One page of guests for the current filters. */
async function fetchPage(
  weddingId: string,
  filters: Filters,
  cursor?: string,
): Promise<Page | { error: ApiError }> {
  try {
    const { data, error, response } = await api.GET('/api/v1/weddings/{weddingId}/guests', {
      params: {
        path: { weddingId },
        query: {
          limit: PAGE_SIZE,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.eventId ? { eventId: filters.eventId } : {}),
          ...(filters.rsvpStatus ? { rsvpStatus: filters.rsvpStatus } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if (error !== undefined || !response.ok || !data) {
      return { error: toApiError(error, response.status) };
    }
    return { guests: data.data, nextCursor: data.meta.pagination.nextCursor };
  } catch {
    return { error: toApiError(undefined, 0) };
  }
}

/** Stitch "P4 · O5 Guests List", with the 0021 corrections. */
export function GuestsList({ wedding }: { wedding: ApiWedding }) {
  const router = useRouter();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [filters, setFilters] = useState<Filters>({ search: '', eventId: '', rsvpStatus: '' });
  const [search, setSearch] = useState('');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showDeleted, dismissDeleted] = useOneOffNotice('guest-deleted');
  // Bumped whenever the list reloads (new filters, retry), so a slower Load more that started
  // earlier cannot add guests from the previous filters (review M4).
  const listVersion = useRef(0);

  function applyFilters(next: Filters) {
    setState({ status: 'loading' });
    setFilters(next);
  }

  // The search box applies after a short pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = search.trim();
      if (trimmed === filters.search) return;
      setState({ status: 'loading' });
      setFilters({ ...filters, search: trimmed });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filters]);

  useEffect(() => {
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((result) => {
      if (result.data) setEvents(result.data);
    });
  }, [wedding.id]);

  useEffect(() => {
    let active = true;
    listVersion.current += 1;
    void fetchPage(wedding.id, filters).then((result) => {
      if (!active) return;
      if ('guests' in result) {
        setState({ status: 'ready', guests: result.guests, nextCursor: result.nextCursor });
      } else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.status === 404 && result.error.code === 'WEDDING_NOT_FOUND') {
        setState({ status: 'gone' });
      } else if (result.error.status === 404) {
        // The chosen event was deleted meanwhile: clear the filter.
        applyFilters({ ...filters, eventId: '' });
      } else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, filters, attempt, router]);

  async function loadMore() {
    if (state.status !== 'ready' || !state.nextCursor) return;
    const version = listVersion.current;
    setLoadingMore(true);
    const result = await fetchPage(wedding.id, filters, state.nextCursor);
    setLoadingMore(false);
    if (version !== listVersion.current) return;
    if ('guests' in result) {
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              guests: [...current.guests, ...result.guests],
              nextCursor: result.nextCursor,
            }
          : current,
      );
    } else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
    else setState({ status: 'error' });
  }

  function clearFilters() {
    setSearch('');
    applyFilters({ search: '', eventId: '', rsvpStatus: '' });
  }

  if (state.status === 'gone') return <NotAvailable />;
  const filtered = Boolean(filters.search || filters.eventId || filters.rsvpStatus);

  return (
    <div>
      <PageHeader
        title={guestsPage.title}
        subtitle={guestsPage.subtitle}
        actions={
          <Can module="GUESTS" action="CREATE">
            <PrimaryLink href={`${GUESTS_PATH}/new`}>{guestsPage.add}</PrimaryLink>
          </Can>
        }
      />

      {showDeleted && (
        <div className="mb-5">
          <Banner tone="success" icon="check_circle">
            <span className="flex items-center justify-between gap-3">
              {guestsPage.deleted}
              <button
                type="button"
                onClick={dismissDeleted}
                aria-label="Dismiss"
                className="flex size-8 items-center justify-center rounded-md"
              >
                <Icon name="close" className="size-4" />
              </button>
            </span>
          </Banner>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{guestsPage.search}</span>
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-outline"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={guestsPage.search}
            className={`${controlClasses} min-h-11 py-2.5 pr-3 pl-10`}
          />
        </label>
        <FilterSelect
          label={guestsPage.eventFilter}
          value={filters.eventId}
          onChange={(eventId) => applyFilters({ ...filters, eventId })}
          options={[
            { value: '', label: guestsPage.allEvents },
            ...events.map((event) => ({ value: event.id, label: event.name })),
          ]}
        />
        <FilterSelect
          label={guestsPage.rsvpFilter}
          value={filters.rsvpStatus}
          onChange={(rsvpStatus) =>
            applyFilters({ ...filters, rsvpStatus: rsvpStatus as RsvpStatus | '' })
          }
          options={[
            { value: '', label: guestsPage.allRsvps },
            ...RSVP_STATUSES.map((status) => ({ value: status, label: rsvpLabels[status] })),
          ]}
        />
      </div>

      {state.status === 'loading' && (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only" role="status">
            {guestsPage.loading}
          </span>
          <SkeletonCard className="h-16" />
          <SkeletonCard className="h-16" />
          <SkeletonCard className="h-16" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-4">
          <Banner tone="error" icon="error">
            {guestsPage.loadError}
          </Banner>
          <SecondaryButton
            icon="refresh"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            {guestsPage.retry}
          </SecondaryButton>
        </div>
      )}

      {state.status === 'ready' && state.guests.length === 0 && (
        <EmptyState filtered={filtered} onClear={clearFilters} />
      )}

      {state.status === 'ready' && state.guests.length > 0 && (
        <>
          <GuestTable guests={state.guests} />
          <ul className="space-y-3 md:hidden">
            {state.guests.map((guest) => (
              <li key={guest.id}>
                <GuestCard guest={guest} />
              </li>
            ))}
          </ul>
          {state.nextCursor && (
            <div className="mt-5 flex justify-center">
              <SecondaryButton
                onClick={() => void loadMore()}
                pending={loadingMore}
                pendingLabel={guestsPage.loadingMore}
                icon="keyboard_arrow_down"
              >
                {guestsPage.loadMore}
              </SecondaryButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative md:w-52">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value ? option.label : `${label}: ${option.label}`}
          </option>
        ))}
      </select>
      <Icon
        name="keyboard_arrow_down"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-outline"
      />
    </label>
  );
}

function EmailStatus({ guest }: { guest: ApiGuest }) {
  const { invitation } = guest;
  const label = emailStatusLabel(invitation);
  const tone =
    label === 'Sent'
      ? 'sage'
      : label === 'Failed'
        ? 'muted'
        : label === 'Draft'
          ? 'champagne'
          : 'neutral';
  return (
    <div className="space-y-1">
      <Chip tone={tone} className={`text-label-sm ${label === 'Failed' ? 'text-error' : ''}`}>
        {label}
      </Chip>
      {invitation?.deliveryStatus === 'FAILED' && (
        <p className="text-body-sm text-error">{invitationPanel.rejected}</p>
      )}
      {invitation?.deliveryStatus !== 'FAILED' && invitation?.lastSentAt && (
        <p className="text-body-sm text-on-surface-variant">
          {guestsPage.lastSent.replace('{date}', formatDateTime(invitation.lastSentAt))}
        </p>
      )}
    </div>
  );
}

function RevokedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-error-container/70 px-2 py-1 text-body-sm font-medium text-on-error-container">
      <Icon name="link_off" className="size-4" />
      {linkRevoked}
    </span>
  );
}

function GuestTable({ guests }: { guests: ApiGuest[] }) {
  const header = 'px-4 py-3 text-left text-label-sm font-semibold text-on-surface-variant';
  return (
    <div className="hidden overflow-hidden rounded-xl border border-hairline bg-white shadow-sm md:block">
      <table className="w-full table-fixed">
        <thead className="border-b border-hairline bg-surface-container-low">
          <tr>
            <th className={`${header} w-[32%]`}>{guestsPage.columns.guest}</th>
            <th className={`${header} w-[16%]`}>{guestsPage.columns.relation}</th>
            <th className={`${header} w-[20%]`}>{guestsPage.columns.emailStatus}</th>
            <th className={`${header} w-[20%]`}>{guestsPage.columns.linkState}</th>
            <th className={`${header} w-[12%] text-right`}>
              <span className="sr-only">{guestsPage.columns.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {guests.map((guest) => (
            <tr key={guest.id} className="align-top">
              <td className="px-4 py-4">
                <p className="font-medium break-words text-navy">{guest.name}</p>
                <p className="text-body-sm text-on-surface-variant">{guest.mobile}</p>
              </td>
              <td className="px-4 py-4 text-body-sm break-words text-on-surface">
                {guest.relation ?? '—'}
              </td>
              <td className="px-4 py-4">
                <EmailStatus guest={guest} />
              </td>
              <td className="px-4 py-4">{guest.invitation?.isRevoked && <RevokedBadge />}</td>
              <td className="px-4 py-4 text-right">
                <ViewLink guest={guest} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuestCard({ guest }: { guest: ApiGuest }) {
  return (
    <article className="rounded-xl border border-hairline bg-white p-4 shadow-sm">
      {guest.relation && (
        <p className="mb-1 text-body-sm text-on-surface-variant">{guest.relation}</p>
      )}
      <h2 className="font-medium break-words text-navy">{guest.name}</h2>
      <p className="mb-3 inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant">
        <Icon name="call" className="size-4" />
        {guest.mobile}
      </p>
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <EmailStatus guest={guest} />
        {guest.invitation?.isRevoked && <RevokedBadge />}
      </div>
      <ViewLink guest={guest} />
    </article>
  );
}

function ViewLink({ guest }: { guest: ApiGuest }) {
  return (
    <Link
      href={`${GUESTS_PATH}/${guest.id}`}
      className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
    >
      {guestsPage.view}
      <Icon name="arrow_forward" className="size-4" />
    </Link>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-hairline bg-white px-6 py-12 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#faf1e4] text-secondary">
        <Icon name={filtered ? 'search_off' : 'person_add'} className="size-7" />
      </span>
      <h2 className="mb-1 font-serif text-headline-sm text-navy">
        {filtered ? guestsPage.noResultsTitle : guestsPage.emptyTitle}
      </h2>
      <p className="mb-6 text-body-sm text-on-surface-variant">
        {filtered ? guestsPage.noResultsBody : guestsPage.emptyBody}
      </p>
      {filtered ? (
        <SecondaryButton icon="filter_alt_off" onClick={onClear}>
          {guestsPage.clearFilters}
        </SecondaryButton>
      ) : (
        <Can module="GUESTS" action="CREATE">
          <PrimaryLink href={`${GUESTS_PATH}/new`}>{guestsPage.add}</PrimaryLink>
        </Can>
      )}
    </section>
  );
}
