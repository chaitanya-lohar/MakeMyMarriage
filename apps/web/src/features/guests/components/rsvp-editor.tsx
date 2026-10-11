'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PrimaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { stepPeople } from '@/features/invitation/rsvp-model';
import { rsvpEditor, rsvpLabels } from '../content';
import { countFor, type RsvpStatus } from '../guest-model';

/** As in the approved panel: the guest responses first, then the organizer-only reset. */
const RESPONSE_ORDER: RsvpStatus[] = ['ATTENDING', 'DECLINED', 'MAYBE', 'PENDING'];

/**
 * The organizer's Edit RSVP panel (Stitch "P4 · O7"): the four responses, and for Attending a
 * count of at least 1 with no maximum. Organizers may reset to Pending (0018 #7).
 */
export function RsvpEditor({
  eventName,
  guestFirstName,
  status,
  attendeeCount,
  pending,
  error,
  onSave,
  onCancel,
}: {
  eventName: string;
  guestFirstName: string;
  status: RsvpStatus;
  attendeeCount: number | null;
  pending: boolean;
  error?: string;
  onSave: (status: RsvpStatus, attendeeCount: number | null) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const countId = useId();
  const firstOption = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState<RsvpStatus>(status);
  const [people, setPeople] = useState(
    String(attendeeCount && attendeeCount > 0 ? attendeeCount : 1),
  );
  const count = Number(people);
  const countValid = Number.isInteger(count) && count >= 1;

  useEffect(() => {
    firstOption.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-navy/40"
        onClick={() => !pending && onCancel()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[460px] rounded-xl border border-hairline bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-serif text-headline-sm text-navy">
            {rsvpEditor.title.replace('{event}', eventName)}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={rsvpEditor.cancel}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>

        <fieldset>
          <legend className="mb-2 text-body-sm font-medium text-navy">{rsvpEditor.response}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RESPONSE_ORDER.map((option, index) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-label-md transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-secondary ${
                  choice === option
                    ? 'border-navy bg-navy text-on-primary'
                    : 'border-outline-variant/70 bg-white text-navy hover:bg-surface-container-low'
                }`}
              >
                <input
                  ref={index === 0 ? firstOption : undefined}
                  type="radio"
                  name="rsvp"
                  value={option}
                  checked={choice === option}
                  onChange={() => setChoice(option)}
                  className="sr-only"
                />
                {rsvpLabels[option]}
              </label>
            ))}
          </div>
        </fieldset>

        {choice === 'ATTENDING' && (
          <div className="mt-5 rounded-lg bg-surface-container-low p-4">
            <label htmlFor={countId} className="mb-2 block text-body-sm font-medium text-navy">
              {rsvpEditor.people.replace('{name}', guestFirstName)}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPeople((current) => stepPeople(current, -1))}
                aria-label={rsvpEditor.fewer}
                className="flex size-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white text-navy"
              >
                <Icon name="remove" className="size-5" />
              </button>
              <input
                id={countId}
                type="text"
                inputMode="numeric"
                value={people}
                onChange={(event) => setPeople(event.target.value.replace(/\D/g, ''))}
                aria-invalid={countValid ? undefined : true}
                className="min-h-11 w-20 rounded-lg border border-outline-variant/70 bg-white text-center text-body-md text-navy"
              />
              <button
                type="button"
                onClick={() => setPeople((current) => stepPeople(current, 1))}
                aria-label={rsvpEditor.more}
                className="flex size-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white text-navy"
              >
                <Icon name="add" className="size-5" />
              </button>
            </div>
            {!countValid && (
              <p className="mt-2 flex items-center gap-1.5 text-body-sm text-error">
                <Icon name="error" className="size-4" />
                {rsvpEditor.atLeastOne}
              </p>
            )}
          </div>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <Icon name="info" className="size-4" />
          {rsvpEditor.resetNote}
        </p>
        {error && (
          <p role="alert" className="mt-3 flex items-center gap-1.5 text-body-sm text-error">
            <Icon name="error" className="size-4" />
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white px-5 text-label-md text-navy hover:bg-surface-container-low"
          >
            {rsvpEditor.cancel}
          </button>
          <PrimaryButton
            pending={pending}
            pendingLabel={rsvpEditor.saving}
            disabled={choice === 'ATTENDING' && !countValid}
            onClick={() => onSave(choice, countFor(choice, count))}
          >
            {rsvpEditor.save}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
