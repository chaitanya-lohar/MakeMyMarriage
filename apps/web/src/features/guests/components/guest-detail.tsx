'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Banner, controlClasses, PrimaryButton, QuietButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { eventTypeIcons, formatEventWhen, type ApiEvent } from '@/features/events/event-model';
import { networkError } from '@/features/weddings/content';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { GUESTS_PATH } from '@/features/workspace/components/shell-parts';
import { SkeletonCard, Can } from '@/features/workspace/components/workspace-page';
import {
  SESSION_ENDED_PATH,
  useReadyWorkspace,
  usePermissions,
} from '@/features/workspace/workspace-context';
import { api, call, type ApiError } from '@/lib/api';
import { deleteGuest, guestDetail, guestsPage, removeFromEvent } from '../content';
import {
  firstNameOf,
  rsvpSummary,
  type ApiGuest,
  type ApiGuestEvent,
  type RsvpStatus,
} from '../guest-model';
import { GuestNotAvailable } from './guest-not-available';
import { InvitationPanel } from './invitation-panel';
import { RsvpEditor } from './rsvp-editor';

interface Loaded {
  guest: ApiGuest;
  assignments: ApiGuestEvent[];
  events: ApiEvent[];
}

/** `/guests/[guestId]`: Stitch "P4 · O7 Guest Detail" with the O8 invitation panel. */
export function GuestDetail({ wedding, guestId }: { wedding: ApiWedding; guestId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'gone' }
    | { status: 'error' }
    | ({ status: 'ready' } & Loaded)
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const handleError = useCallback(
    (error: ApiError): boolean => {
      if (error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (
        error.status === 404 &&
        ['GUEST_NOT_FOUND', 'WEDDING_NOT_FOUND'].includes(error.code)
      ) {
        setState({ status: 'gone' });
      } else return false;
      return true;
    },
    [router],
  );

  // Loads on mount and again whenever `attempt` changes; the current view stays meanwhile.
  useEffect(() => {
    let active = true;
    const path = { weddingId: wedding.id, guestId };
    void Promise.all([
      call(() => api.GET('/api/v1/weddings/{weddingId}/guests/{guestId}', { params: { path } })),
      call(() =>
        api.GET('/api/v1/weddings/{weddingId}/guests/{guestId}/events', { params: { path } }),
      ),
      call(() =>
        api.GET('/api/v1/weddings/{weddingId}/events', {
          params: { path: { weddingId: wedding.id } },
        }),
      ),
    ]).then(([guest, assignments, events]) => {
      if (!active) return;
      if (guest.data && assignments.data && events.data) {
        setState({
          status: 'ready',
          guest: guest.data,
          assignments: assignments.data,
          events: events.data,
        });
        return;
      }
      const error = guest.error ?? assignments.error ?? events.error;
      if (!error || !handleError(error)) setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, guestId, handleError, attempt]);

  if (state.status === 'gone') return <GuestNotAvailable />;
  if (state.status === 'error') {
    return (
      <div className="space-y-4">
        <Banner tone="error" icon="error">
          {guestDetail.loadError}
        </Banner>
        <PrimaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
          {guestsPage.retry}
        </PrimaryButton>
      </div>
    );
  }
  if (state.status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  return (
    <GuestDetailView
      wedding={wedding}
      data={state}
      reload={() => setAttempt((value) => value + 1)}
      onError={handleError}
    />
  );
}

function GuestDetailView({
  wedding,
  data,
  reload,
  onError,
}: {
  wedding: ApiWedding;
  data: Loaded;
  reload: () => void;
  onError: (error: ApiError) => boolean;
}) {
  const router = useRouter();
  const { setNotice } = useReadyWorkspace();
  const { can } = usePermissions();
  const { guest, assignments, events } = data;
  const firstName = firstNameOf(guest.name);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const assigned = new Set(assignments.map((assignment) => assignment.eventId));
  const unassigned = events.filter((event) => !assigned.has(event.id));

  const [choice, setChoice] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string>();
  const [editing, setEditing] = useState<ApiGuestEvent | null>(null);
  const [removing, setRemoving] = useState<ApiGuestEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [dialogError, setDialogError] = useState<string>();

  const errorText = (error: ApiError) =>
    error.status === 0 ? networkError : guestDetail.actionError;

  async function addToEvent() {
    if (!choice) return;
    setAdding(true);
    setMessage(undefined);
    const result = await call(() =>
      api.POST('/api/v1/weddings/{weddingId}/guests/{guestId}/events', {
        params: { path: { weddingId: wedding.id, guestId: guest.id } },
        body: { eventId: choice },
      }),
    );
    setAdding(false);
    if (result.error && !onError(result.error)) setMessage(errorText(result.error));
    setChoice('');
    reload();
  }

  async function saveRsvp(status: RsvpStatus, attendeeCount: number | null) {
    if (!editing) return;
    setPending(true);
    setDialogError(undefined);
    const result = await call(() =>
      api.PATCH('/api/v1/weddings/{weddingId}/guest-events/{guestEventId}', {
        params: { path: { weddingId: wedding.id, guestEventId: editing.id } },
        body: { rsvpStatus: status, attendeeCount },
      }),
    );
    setPending(false);
    if (result.error && !onError(result.error) && result.error.status !== 404) {
      setDialogError(errorText(result.error));
      return;
    }
    setEditing(null);
    reload();
  }

  async function confirmRemove() {
    if (!removing) return;
    setPending(true);
    setDialogError(undefined);
    const result = await call(() =>
      api.DELETE('/api/v1/weddings/{weddingId}/guest-events/{guestEventId}', {
        params: { path: { weddingId: wedding.id, guestEventId: removing.id } },
      }),
    );
    setPending(false);
    if (result.error && !onError(result.error) && result.error.status !== 404) {
      setDialogError(errorText(result.error));
      return;
    }
    setRemoving(null);
    reload();
  }

  async function confirmDelete() {
    setPending(true);
    setDialogError(undefined);
    const result = await call(() =>
      api.DELETE('/api/v1/weddings/{weddingId}/guests/{guestId}', {
        params: { path: { weddingId: wedding.id, guestId: guest.id } },
      }),
    );
    setPending(false);
    if (!result.error || result.error.status === 404) {
      setNotice('guest-deleted');
      router.push(GUESTS_PATH);
    } else if (result.error.status === 401) {
      router.replace(SESSION_ENDED_PATH);
    } else {
      setDialogError(result.error.status === 0 ? networkError : deleteGuest.error);
    }
  }

  const closeDialogs = useCallback(() => {
    setEditing(null);
    setRemoving(null);
    setDeleting(false);
    setDialogError(undefined);
  }, []);

  const editingEvent = editing ? eventsById.get(editing.eventId) : undefined;
  const removingEvent = removing ? eventsById.get(removing.eventId) : undefined;

  return (
    <div>
      <Link
        href={GUESTS_PATH}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-label-md text-on-surface-variant transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary"
      >
        <Icon name="arrow_back" className="size-4" />
        {guestDetail.back}
      </Link>

      <section className="mb-6 flex flex-col gap-5 rounded-xl border border-hairline bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-headline-md break-words text-navy">{guest.name}</h1>
            {guest.relation && (
              <Chip tone="neutral" className="text-label-sm">
                {guest.relation}
              </Chip>
            )}
          </div>
          <p className="flex flex-col gap-1 text-body-sm text-on-surface-variant sm:flex-row sm:flex-wrap sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="call" className="size-4" />
              {guest.mobile}
            </span>
            {guest.email && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Icon name="mail" className="size-4 shrink-0" />
                <span className="break-all">{guest.email}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Can module="GUESTS" action="EDIT">
            <Link
              href={`${GUESTS_PATH}/${guest.id}/edit`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant/70 bg-white px-4 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
            >
              <Icon name="edit" className="size-4" />
              {guestDetail.edit}
            </Link>
          </Can>
          <Can module="GUESTS" action="DELETE">
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-error/40 bg-white px-4 text-label-md text-error transition-colors hover:bg-error-container/40 focus-visible:outline-2 focus-visible:outline-secondary"
            >
              <Icon name="delete" className="size-4" />
              {guestDetail.delete}
            </button>
          </Can>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-hairline bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-serif text-headline-sm text-navy">{guestDetail.eventsTitle}</h2>
          {unassigned.length > 0 && can('GUESTS', 'CREATE') && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <span className="sr-only">{guestDetail.chooseEvent}</span>
                <select
                  value={choice}
                  onChange={(event) => setChoice(event.target.value)}
                  className={`${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3 sm:w-56`}
                >
                  <option value="">{guestDetail.chooseEvent}</option>
                  {unassigned.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
                <Icon
                  name="keyboard_arrow_down"
                  className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-outline"
                />
              </label>
              <PrimaryButton
                icon="add"
                onClick={() => void addToEvent()}
                disabled={!choice}
                pending={adding}
                pendingLabel={guestDetail.adding}
              >
                {guestDetail.addToEvent}
              </PrimaryButton>
            </div>
          )}
        </div>

        {message && (
          <div className="mb-4">
            <Banner tone="error" icon="error">
              {message}
            </Banner>
          </div>
        )}

        {assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline px-6 py-10 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#faf1e4] text-secondary">
              <Icon name="event_busy" className="size-6" />
            </span>
            <p className="mb-1 font-serif text-title-lg font-medium text-navy">
              {guestDetail.noEventsTitle.replace('{name}', firstName)}
            </p>
            <p className="text-body-sm text-on-surface-variant">
              {events.length === 0
                ? guestDetail.noEventsToAdd
                : guestDetail.noEventsBody.replace('{name}', firstName)}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {assignments.map((assignment) => {
              const event = eventsById.get(assignment.eventId);
              if (!event) return null;
              return (
                <li
                  key={assignment.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 gap-3">
                    <Icon
                      name={eventTypeIcons[event.type]}
                      className="mt-0.5 size-5 text-secondary"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium break-words text-navy">{event.name}</p>
                        <Chip
                          tone={assignment.rsvpStatus === 'ATTENDING' ? 'sage' : 'neutral'}
                          className="text-label-sm"
                        >
                          {rsvpSummary(assignment.rsvpStatus, assignment.attendeeCount)}
                        </Chip>
                      </div>
                      <p className="text-body-sm text-on-surface-variant">
                        {formatEventWhen(event)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Can module="INVITATIONS" action="EDIT">
                      <QuietButton icon="edit_note" onClick={() => setEditing(assignment)}>
                        {guestDetail.editRsvp}
                      </QuietButton>
                    </Can>
                    <Can module="GUESTS" action="DELETE">
                      <QuietButton icon="person_remove" onClick={() => setRemoving(assignment)}>
                        {guestDetail.removeFromEvent}
                      </QuietButton>
                    </Can>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Can module="INVITATIONS" action="VIEW">
        <InvitationPanel
          wedding={wedding}
          guest={guest}
          onGuestChanged={reload}
          onError={onError}
        />
      </Can>

      {editing && editingEvent && (
        <RsvpEditor
          eventName={editingEvent.name}
          guestFirstName={firstName}
          status={editing.rsvpStatus}
          attendeeCount={editing.attendeeCount}
          pending={pending}
          error={dialogError}
          onSave={(status, count) => void saveRsvp(status, count)}
          onCancel={closeDialogs}
        />
      )}

      {removing && removingEvent && (
        <ConfirmDialog
          title={removeFromEvent.title
            .replace('{name}', firstName)
            .replace('{event}', removingEvent.name)}
          body={removeFromEvent.body
            .replace('{name}', firstName)
            .replace('{event}', removingEvent.name)}
          icon="event_busy"
          confirmLabel={removeFromEvent.confirm}
          cancelLabel={removeFromEvent.cancel}
          pendingLabel={removeFromEvent.removing}
          tone="danger"
          pending={pending}
          error={dialogError}
          onConfirm={() => void confirmRemove()}
          onCancel={closeDialogs}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={deleteGuest.title.replace('{name}', guest.name)}
          body={deleteGuest.body.replace('{firstName}', firstName)}
          icon="person_remove"
          confirmLabel={deleteGuest.confirm}
          cancelLabel={deleteGuest.cancel}
          pendingLabel={deleteGuest.deleting}
          tone="danger"
          pending={pending}
          error={dialogError}
          onConfirm={() => void confirmDelete()}
          onCancel={closeDialogs}
        />
      )}
    </div>
  );
}
