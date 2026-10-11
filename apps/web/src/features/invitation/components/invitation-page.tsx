'use client';

import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { legalLinks } from '@/components/layout/site-links';
import { Banner, PrimaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import { formatEventWhen } from '@/features/events/event-model';
import { formatLongDate } from '@/features/weddings/dates';
import { api, call, type ApiError } from '@/lib/api';
import {
  invitationErrors,
  invitationFooter,
  invitationPage,
  linkNotWorking,
  noEvents,
  rsvpSaved,
} from '../content';
import {
  answersFrom,
  coupleLines,
  peopleValid,
  toResponses,
  type Answer,
  type GuestChoice,
  type GuestView,
  type GuestViewEvent,
} from '../rsvp-model';

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; view: GuestView };

function loadErrorMessage(error: ApiError): string {
  if (error.status === 429) return invitationErrors.rateLimited;
  return error.status === 0 ? invitationErrors.network : invitationErrors.loadServer;
}

/**
 * The guest's invitation, opened from their private link without an account (Stitch
 * "P4 · G1 / G2" and "G3 / G4 / G5"; decision 0017). It shows only the guest's own events.
 */
export function InvitationPage({ token }: { token: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/guest/invitations/{token}', { params: { path: { token } } }),
    ).then((result) => {
      if (!active) return;
      if (result.data) setState({ status: 'ready', view: result.data });
      else if (result.error.status === 404) setState({ status: 'not-found' });
      else setState({ status: 'error', message: loadErrorMessage(result.error) });
    });
    return () => {
      active = false;
    };
  }, [token, attempt]);

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-navy">
      <header className="flex h-16 items-center justify-center border-b border-hairline px-4">
        <Logo className="h-9 w-auto" />
      </header>
      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-8 sm:py-12">
        {state.status === 'loading' && (
          <div className="space-y-4" aria-busy="true">
            <span className="sr-only" role="status">
              {invitationPage.loading}
            </span>
            <div className="mx-auto h-10 w-2/3 animate-pulse rounded bg-[#efece6]" />
            <div className="h-56 animate-pulse rounded-xl border border-hairline bg-white" />
          </div>
        )}
        {state.status === 'not-found' && (
          <Notice icon="link_off" title={linkNotWorking.title} body={linkNotWorking.body} />
        )}
        {state.status === 'error' && (
          <div className="space-y-4">
            <Banner tone="error" icon="error">
              {state.message}
            </Banner>
            <PrimaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
              {invitationErrors.retry}
            </PrimaryButton>
          </div>
        )}
        {state.status === 'ready' && (
          <Invitation
            token={token}
            view={state.view}
            onLinkGone={() => setState({ status: 'not-found' })}
          />
        )}
      </main>
      <footer className="flex flex-col items-center gap-1 border-t border-hairline px-4 py-6 text-xs text-on-surface-variant">
        <div className="flex items-center gap-2">
          {legalLinks.map((link, index) => (
            <span key={link.href} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">·</span>}
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center px-1 hover:text-navy"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </div>
        <p>{invitationFooter.copyright}</p>
      </footer>
    </div>
  );
}

function Notice({
  icon,
  title,
  body,
}: {
  icon: 'link_off' | 'event_busy';
  title: string;
  body: string;
}) {
  return (
    <section className="mt-6 rounded-xl border border-hairline bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-champagne/40 bg-[#faf1e4] text-secondary">
        <Icon name={icon} className="size-7" />
      </span>
      <h1 className="mb-3 font-serif text-headline-md text-navy">{title}</h1>
      <p className="mx-auto max-w-[380px] text-body-md text-on-surface-variant">{body}</p>
    </section>
  );
}

function Invitation({
  token,
  view: initial,
  onLinkGone,
}: {
  token: string;
  view: GuestView;
  onLinkGone: () => void;
}) {
  const [view, setView] = useState(initial);
  const [answers, setAnswers] = useState(() => answersFrom(initial));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const firstName = view.guest.name.trim().split(/\s+/)[0] ?? view.guest.name;

  function update(guestEventId: string, change: Partial<Answer>) {
    setAnswers((current) => ({
      ...current,
      [guestEventId]: { ...(current[guestEventId] as Answer), ...change },
    }));
    setError(null);
    setSaved(false);
  }

  async function send() {
    const responses = toResponses(answers);
    if (responses === null) {
      setError(invitationErrors.headcount);
      return;
    }
    if (responses.length === 0) {
      setError(invitationPage.nothingChosen);
      return;
    }
    setPending(true);
    setError(null);
    const result = await call(() =>
      api.PATCH('/api/v1/guest/invitations/{token}/rsvp', {
        params: { path: { token } },
        body: { responses },
      }),
    );
    setPending(false);
    if (result.data) {
      setView(result.data);
      setAnswers(answersFrom(result.data));
      setSaved(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const { status } = result.error;
    if (status === 404) onLinkGone();
    else if (status === 429) setError(invitationErrors.rateLimited);
    else setError(status === 0 ? invitationErrors.network : invitationErrors.server);
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-champagne/50 bg-[#faf1e4] px-3 py-1 text-body-sm text-[#7a5e2e]">
          <Icon name="favorite" className="size-4" />
          {invitationPage.greeting.replace('{name}', view.guest.name)}
        </p>
        <h1 className="font-serif text-headline-lg-mobile break-words text-navy sm:text-headline-lg">
          {coupleLines(view.wedding.displayName).map((line, index, lines) => (
            <span key={line} className="block">
              {line}
              {index < lines.length - 1 && (
                <span className="block text-headline-sm text-champagne italic">&amp;</span>
              )}
            </span>
          ))}
        </h1>
        {view.wedding.startDate && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <Icon name="calendar_today" className="size-4 text-secondary" />
            {formatLongDate(view.wedding.startDate)}
          </p>
        )}
      </div>

      {saved && <SavedSummary name={firstName} view={view} />}

      {view.events.length === 0 ? (
        <Notice icon="event_busy" title={noEvents.title} body={noEvents.body} />
      ) : (
        <>
          <p className="mb-5 text-center text-body-md text-on-surface-variant">
            {invitationPage.intro}
          </p>
          <ul className="space-y-5">
            {view.events.map((event) => (
              <li key={event.guestEventId}>
                <EventCard
                  event={event}
                  answer={answers[event.guestEventId] as Answer}
                  disabled={pending}
                  onChange={(change) => update(event.guestEventId, change)}
                />
              </li>
            ))}
          </ul>
          <div className="sticky bottom-0 -mx-4 mt-6 border-t border-hairline bg-ivory/95 px-4 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            {error && (
              <p role="alert" className="mb-3 flex items-center gap-1.5 text-body-sm text-error">
                <Icon name="error" className="size-4" />
                {error}
              </p>
            )}
            <PrimaryButton
              icon="send"
              className="w-full"
              onClick={() => void send()}
              pending={pending}
              pendingLabel={invitationPage.sending}
            >
              {invitationPage.send}
            </PrimaryButton>
            <p className="mt-3 text-center text-body-sm text-on-surface-variant">
              {invitationPage.note}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SavedSummary({ name, view }: { name: string; view: GuestView }) {
  return (
    <section
      role="status"
      className="mb-8 rounded-xl border border-tertiary-fixed-dim bg-[#eef4f0] p-5 text-[#2d5a3f]"
    >
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <Icon name="check_circle" className="size-5" />
        {rsvpSaved.title.replace('{name}', name)}
      </p>
      <p className="mb-2 text-label-sm uppercase">{rsvpSaved.answers}</p>
      <ul className="mb-3 space-y-1 text-body-sm">
        {view.events.map((event) => (
          <li key={event.guestEventId} className="flex justify-between gap-3">
            <span className="break-words">{event.name}</span>
            <span className="font-medium">{answerText(event)}</span>
          </li>
        ))}
      </ul>
      <p className="text-body-sm">{rsvpSaved.later}</p>
    </section>
  );
}

function answerText(event: GuestViewEvent): string {
  switch (event.rsvpStatus) {
    case 'ATTENDING':
      return `${invitationPage.attending} · ${event.attendeeCount ?? 1}`;
    case 'DECLINED':
      return invitationPage.declined;
    case 'MAYBE':
      return invitationPage.maybe;
    default:
      return invitationPage.awaiting;
  }
}

const CHOICES: { value: GuestChoice; label: string }[] = [
  { value: 'ATTENDING', label: invitationPage.attending },
  { value: 'DECLINED', label: invitationPage.declined },
  { value: 'MAYBE', label: invitationPage.maybe },
];

function EventCard({
  event,
  answer,
  disabled,
  onChange,
}: {
  event: GuestViewEvent;
  answer: Answer;
  disabled: boolean;
  onChange: (change: Partial<Answer>) => void;
}) {
  const legendId = useId();
  const countId = useId();
  const count = Number(answer.people);
  const valid = peopleValid(answer.people);
  const venue = [event.venue.name, event.venue.address].filter(Boolean).join(', ');

  return (
    <article className="rounded-xl border border-hairline bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-headline-sm break-words text-navy">{event.name}</h2>
        {!answer.choice && (
          <span className="rounded-full border border-champagne/50 bg-[#faf1e4] px-2.5 py-0.5 text-label-sm text-[#7a5e2e]">
            {invitationPage.awaiting}
          </span>
        )}
      </div>
      <Detail icon="calendar_today">{formatEventWhen(event)}</Detail>
      {venue && <Detail icon="location_on">{venue}</Detail>}
      {event.dressCode && (
        <Detail icon="checkroom">
          {invitationPage.dressCode.replace('{value}', event.dressCode)}
        </Detail>
      )}
      {event.description && (
        <p className="mt-3 rounded-lg bg-surface-container-low p-3 text-body-sm whitespace-pre-line text-on-surface">
          {event.description}
        </p>
      )}

      <fieldset className="mt-5" aria-labelledby={legendId}>
        <legend id={legendId} className="mb-2 text-body-sm font-medium text-navy">
          {invitationPage.yourResponse}
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {CHOICES.map((choice) => (
            <label
              key={choice.value}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-label-md transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-secondary ${
                answer.choice === choice.value
                  ? 'border-navy bg-navy text-on-primary'
                  : 'border-outline-variant/70 bg-white text-navy hover:bg-surface-container-low'
              }`}
            >
              <input
                type="radio"
                name={`rsvp-${event.guestEventId}`}
                value={choice.value}
                checked={answer.choice === choice.value}
                onChange={() => onChange({ choice: choice.value })}
                disabled={disabled}
                className="sr-only"
              />
              {choice.label}
            </label>
          ))}
        </div>
      </fieldset>

      {answer.choice === 'ATTENDING' && (
        <div className="mt-4 rounded-lg bg-surface-container-low p-4">
          <label htmlFor={countId} className="mb-2 block text-body-sm font-medium text-navy">
            {invitationPage.peopleQuestion}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ people: String(Math.max(1, (valid ? count : 1) - 1)) })}
              disabled={disabled}
              aria-label={invitationPage.fewer}
              className="flex size-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white text-navy"
            >
              <Icon name="remove" className="size-5" />
            </button>
            <input
              id={countId}
              type="text"
              inputMode="numeric"
              value={answer.people}
              onChange={(inputEvent) =>
                onChange({ people: inputEvent.target.value.replace(/\D/g, '') })
              }
              disabled={disabled}
              aria-invalid={valid ? undefined : true}
              className="min-h-11 w-20 rounded-lg border border-outline-variant/70 bg-white text-center text-body-md text-navy aria-[invalid=true]:border-error"
            />
            <button
              type="button"
              onClick={() => onChange({ people: String((valid ? count : 0) + 1) })}
              disabled={disabled}
              aria-label={invitationPage.more}
              className="flex size-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white text-navy"
            >
              <Icon name="add" className="size-5" />
            </button>
          </div>
          {!valid && (
            <p className="mt-2 flex items-center gap-1.5 text-body-sm text-error">
              <Icon name="error" className="size-4" />
              {invitationErrors.headcount}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Detail({
  icon,
  children,
}: {
  icon: 'calendar_today' | 'location_on' | 'checkroom';
  children: ReactNode;
}) {
  return (
    <p className="mt-1.5 flex items-start gap-2 text-body-sm break-words text-on-surface-variant">
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-secondary" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
