'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { DashboardSummaries } from '@/features/dashboard/components/dashboard-summaries';
import { OwnershipOfferBanner } from '@/features/members/components/ownership';
import { WEDDING_DETAILS_PATH } from '@/features/workspace/components/shell-parts';
import { weddingSelector } from '@/features/workspace/content';
import { usePermissions, useWorkspace } from '@/features/workspace/workspace-context';
import { dashboard, weddingDetailsPage } from '../content';
import { daysBetween, formatDate, formatLongDate, todayIn } from '../dates';
import type { ApiWedding } from '../wedding-form-model';

/**
 * Stitch "P3 · S4 Dashboard": normal, just created and countdown states (decision 0016), with
 * the Phase 4 summaries below ("P4 · O10", decision 0022).
 */
export function DashboardView({ wedding }: { wedding: ApiWedding }) {
  const { notice, setNotice } = useWorkspace();
  const { can } = usePermissions();
  // The "created" and "saved" toasts belong to this visit only: keep them here and clear the
  // shared flag, so returning to the dashboard later does not show them again. Saving the
  // wedding or an event both confirm with "Your changes have been saved."
  const [shownNotice, setShownNotice] = useState(() =>
    notice === 'wedding-created' ||
    notice === 'wedding-saved' ||
    notice === 'event-saved' ||
    notice === 'wedding-switched'
      ? notice
      : null,
  );
  useEffect(() => setNotice(null), [setNotice]);
  const place = [wedding.venueName, wedding.primaryCity].filter(Boolean).join(', ');

  return (
    <div>
      {shownNotice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-[#2d5a3f]/30 bg-[#ebf3ee] py-1 pr-1 pl-3 shadow-sm lg:fixed lg:top-6 lg:right-6 lg:z-30 lg:mb-0 lg:w-auto"
        >
          <p className="flex items-center gap-2.5 text-body-sm font-semibold text-[#2d5a3f]">
            <Icon name="check_circle" className="size-5" />
            {shownNotice === 'wedding-created'
              ? dashboard.created
              : shownNotice === 'wedding-switched'
                ? weddingSelector.switched(wedding.displayName)
                : weddingDetailsPage.saved}
          </p>
          <button
            type="button"
            onClick={() => setShownNotice(null)}
            aria-label={dashboard.dismiss}
            className="flex size-11 items-center justify-center rounded-md text-[#2d5a3f]/80 transition-colors hover:text-[#2d5a3f] focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>
      )}

      <header className="mb-8 flex flex-col gap-5 border-b border-hairline pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-label-sm text-secondary uppercase">{dashboard.eyebrow}</p>
          <h1 className="mb-3 font-serif text-headline-md font-normal break-words text-navy sm:text-headline-lg sm:font-normal">
            {wedding.displayName}
          </h1>
          <div className="flex flex-col gap-1.5 text-body-sm text-on-surface-variant sm:flex-row sm:items-center sm:gap-3">
            {wedding.startDate && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar_month" className="size-4 text-secondary" />
                {formatLongDate(wedding.startDate)}
              </span>
            )}
            {wedding.startDate && place && (
              <span aria-hidden="true" className="hidden text-outline-variant sm:inline">
                ·
              </span>
            )}
            {place && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="location_on" className="size-4 text-secondary" />
                {place}
              </span>
            )}
          </div>
        </div>
        {can('WEDDING_SETTINGS', 'EDIT') && (
          <Link
            href={WEDDING_DETAILS_PATH}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-navy px-5 text-label-md text-on-primary shadow-sm transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            {dashboard.edit}
          </Link>
        )}
      </header>

      <OwnershipOfferBanner />
      <CountdownCard startDate={wedding.startDate} timezone={wedding.timezone} />
      <DetailsCard wedding={wedding} />
      <DashboardSummaries wedding={wedding} />
    </div>
  );
}

function CountdownCard({ startDate, timezone }: { startDate: string | null; timezone: string }) {
  const card = 'mb-6 rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8';

  if (!startDate) {
    return (
      <section
        className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div>
          <h2 className="font-serif text-headline-sm text-navy">{dashboard.noDateTitle}</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">{dashboard.noDateBody}</p>
        </div>
        <Link
          href={WEDDING_DETAILS_PATH}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-champagne bg-white px-4 text-label-md text-navy transition-colors hover:bg-ivory focus-visible:outline-2 focus-visible:outline-secondary"
        >
          {dashboard.addDate}
        </Link>
      </section>
    );
  }

  const days = daysBetween(todayIn(timezone), startDate);

  if (days === 0) {
    return (
      <section className={card}>
        <p className="font-serif text-navy">
          <span className="text-headline-lg">{dashboard.today}</span>{' '}
          <span className="text-headline-sm text-on-surface-variant italic">
            {dashboard.todaySuffix}
          </span>
        </p>
        <p className="mt-1 text-body-sm text-on-surface-variant">{formatLongDate(startDate)}</p>
      </section>
    );
  }

  if (days < 0) {
    return (
      <section className={card}>
        <p className="text-label-sm text-on-surface-variant uppercase">{dashboard.celebratedOn}</p>
        <p className="mt-1 font-serif text-headline-md text-navy">{formatDate(startDate)}</p>
      </section>
    );
  }

  return (
    <section className={card}>
      <p className="mb-2 font-serif text-[3.75rem] leading-none text-navy">
        {days.toLocaleString('en-IN')}
      </p>
      <p className="mb-1 text-body-lg font-medium text-on-surface">
        {days === 1 ? dashboard.daysToGo.one : dashboard.daysToGo.other}
      </p>
      <p className="text-body-sm text-on-surface-variant">
        {dashboard.until.replace('{date}', formatLongDate(startDate))}
      </p>
    </section>
  );
}

function DetailsCard({ wedding }: { wedding: ApiWedding }) {
  const rows: { label: string; value: string | null; wide?: boolean }[] = [
    { label: dashboard.bride, value: wedding.brideName },
    { label: dashboard.groom, value: wedding.groomName },
    {
      label: dashboard.weddingDate,
      value: wedding.startDate ? formatDate(wedding.startDate) : null,
    },
    { label: dashboard.venue, value: wedding.venueName },
    { label: dashboard.city, value: wedding.primaryCity, wide: true },
  ];

  return (
    <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-6 border-b border-hairline pb-3 font-serif text-headline-sm text-navy">
        {dashboard.detailsTitle}
      </h2>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className={row.wide ? 'sm:col-span-2' : undefined}>
            <dt className="mb-0.5 text-xs text-on-surface-variant">{row.label}</dt>
            <dd
              className={
                row.value ? 'font-medium break-words text-navy' : 'text-on-surface-variant italic'
              }
            >
              {row.value ?? dashboard.notAdded}
            </dd>
          </div>
        ))}
      </dl>
      <hr className="my-6 border-hairline" />
      <h3 className="mb-2 text-label-sm text-on-surface-variant uppercase">{dashboard.about}</h3>
      <p
        className={`text-sm leading-relaxed whitespace-pre-line ${
          wedding.description ? 'text-on-surface' : 'text-on-surface-variant italic'
        }`}
      >
        {wedding.description ?? dashboard.noDescription}
      </p>
    </section>
  );
}
