'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { Banner, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { NotAvailable } from '@/features/weddings/components/not-available';
import { todayIn } from '@/features/weddings/dates';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { EVENTS_PATH } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  PrimaryLink,
  SkeletonCard,
  useOneOffNotice,
  Can,
} from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { eventsPage, eventTypeLabels } from '../content';
import { eventTypeIcons, formatEventWhen, isPast, type ApiEvent } from '../event-model';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'gone' }
  | { status: 'ready'; events: ApiEvent[] };

/** Stitch "P4 · O2 Events List", with the 0021 corrections. */
export function EventsList({ wedding }: { wedding: ApiWedding }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [showDeleted, dismissDeleted] = useOneOffNotice('event-deleted');

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((result) => {
      if (!active) return;
      if (result.data) setState({ status: 'ready', events: result.data });
      else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.status === 404) setState({ status: 'gone' });
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, attempt, router]);

  if (state.status === 'gone') return <NotAvailable />;
  const today = todayIn(wedding.timezone);

  return (
    <div>
      <PageHeader
        title={eventsPage.title}
        subtitle={eventsPage.subtitle}
        actions={
          <Can module="EVENTS" action="CREATE">
            <PrimaryLink href={`${EVENTS_PATH}/new`}>{eventsPage.add}</PrimaryLink>
          </Can>
        }
      />

      {showDeleted && (
        <div className="mb-5">
          <Banner tone="success" icon="check_circle">
            <span className="flex items-center justify-between gap-3">
              {eventsPage.deleted}
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

      {state.status === 'loading' && (
        <div className="space-y-4" aria-busy="true">
          <span className="sr-only" role="status">
            {eventsPage.loading}
          </span>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-4">
          <Banner tone="error" icon="error">
            {eventsPage.loadError}
          </Banner>
          <SecondaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
            {eventsPage.retry}
          </SecondaryButton>
        </div>
      )}

      {state.status === 'ready' && state.events.length === 0 && <EmptyEvents />}

      {state.status === 'ready' && state.events.length > 0 && (
        <ul className="space-y-4">
          {state.events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} past={isPast(event, today)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({ event, past }: { event: ApiEvent; past: boolean }) {
  return (
    <article
      className={`flex flex-col gap-4 rounded-xl border border-hairline p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        past ? 'bg-surface-container-low' : 'bg-white'
      }`}
    >
      <div className="flex min-w-0 gap-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#faf1e4] text-secondary"
        >
          <Icon name={eventTypeIcons[event.type]} className="size-6" />
        </span>
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Chip tone={past ? 'neutral' : 'champagne'} shape="tag" className="text-label-sm">
              {eventTypeLabels[event.type].toUpperCase()}
            </Chip>
            {past && (
              <Chip tone="muted" className="text-label-sm">
                {eventsPage.past}
              </Chip>
            )}
            <h2 className="font-serif text-title-lg font-medium break-words text-navy">
              {event.name}
            </h2>
          </div>
          <p className="flex flex-col gap-1 text-body-sm text-on-surface-variant sm:flex-row sm:flex-wrap sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar_today" className="size-4 text-secondary" />
              {formatEventWhen(event)}
            </span>
            {event.venue.name && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Icon name="location_on" className="size-4 shrink-0 text-secondary" />
                <span className="break-words">{event.venue.name}</span>
              </span>
            )}
          </p>
        </div>
      </div>
      <Link
        href={`${EVENTS_PATH}/${event.id}`}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-outline-variant/70 bg-white px-4 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
      >
        {eventsPage.edit}
        <Icon name="chevron_right" className="size-4" />
      </Link>
    </article>
  );
}

function EmptyEvents() {
  return (
    <section className="rounded-xl border border-dashed border-hairline bg-white px-6 py-12 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#faf1e4] text-secondary">
        <Icon name="calendar_today" className="size-7" />
      </span>
      <h2 className="mb-1 font-serif text-headline-sm text-navy">{eventsPage.emptyTitle}</h2>
      <p className="mb-6 text-body-sm text-on-surface-variant">{eventsPage.emptyBody}</p>
      <Can module="EVENTS" action="CREATE">
        <PrimaryLink href={`${EVENTS_PATH}/new`}>{eventsPage.add}</PrimaryLink>
      </Can>
    </section>
  );
}
