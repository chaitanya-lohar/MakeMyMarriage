'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { formatDate } from '@/features/weddings/dates';
import { roleLabels, weddingSelector as copy } from '../content';
import { useWorkspace } from '../workspace-context';
import { initialsOf, WeddingName } from './shell-parts';

/** "18 Nov 2026 · Jaipur", leaving out whatever the wedding does not have. */
function weddingLine(wedding: ApiWedding): string {
  return [wedding.startDate ? formatDate(wedding.startDate) : null, wedding.primaryCity]
    .filter(Boolean)
    .join(' · ');
}

function Monogram({ wedding }: { wedding: ApiWedding }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy font-serif text-sm text-white"
    >
      {initialsOf(`${wedding.brideName} ${wedding.groomName}`)}
    </span>
  );
}

/**
 * The wedding block at the top of the navigation (Stitch "P10 · M11", 0035 #4). With one
 * wedding it is plain text; with several it opens "Your weddings", each with the user's role
 * in it, and choosing one switches the whole workspace (System Design §7.12).
 */
export function WeddingSelector({
  wedding,
  onNavigate,
  size = 'text-base',
}: {
  wedding: ApiWedding;
  onNavigate?: () => void;
  size?: string;
}) {
  const { state, selectWedding } = useWorkspace();
  const weddings = state.status === 'ready' ? state.weddings : [wedding];
  const [open, setOpen] = useState(false);
  const listId = useId();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const line = weddingLine(wedding);
  if (weddings.length < 2) {
    return (
      <div>
        <WeddingName name={wedding.displayName} className={size} />
        {line && <p className="mt-0.5 text-body-sm text-on-surface-variant">{line}</p>}
      </div>
    );
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${copy.open}: ${wedding.displayName}`}
        className="flex w-full items-start justify-between gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-secondary"
      >
        <span className="min-w-0">
          <WeddingName name={wedding.displayName} className={size} />
          {line && (
            <span className="mt-0.5 block text-body-sm text-on-surface-variant">{line}</span>
          )}
        </span>
        <Icon
          name="keyboard_arrow_down"
          className={`mt-1 size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          id={listId}
          className="absolute top-full right-0 left-0 z-30 mt-2 rounded-xl border border-hairline bg-white p-2 shadow-lg"
        >
          <p className="px-2 pt-1 pb-2 text-label-sm text-on-surface-variant uppercase">
            {copy.title}
          </p>
          <ul>
            {weddings.map((candidate) => {
              const current = candidate.id === wedding.id;
              const role = candidate.membership?.role;
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    aria-current={current ? 'true' : undefined}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                      if (!current) selectWedding(candidate.id);
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
                  >
                    <Monogram wedding={candidate} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label-md text-navy">
                        {candidate.displayName}
                      </span>
                      <span className="block truncate text-body-sm text-on-surface-variant">
                        {weddingLine(candidate)}
                      </span>
                    </span>
                    {role && (
                      <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-label-sm text-navy">
                        {roleLabels[role] ?? role}
                      </span>
                    )}
                    {current && (
                      <Icon
                        name="check"
                        className="size-5 shrink-0 text-secondary"
                        label={copy.current}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
