'use client';

import type { components } from '@makemymarriage/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banner, SecondaryButton } from '@/components/ui/form';
import { Icon, type IconName } from '@/components/ui/icon';
import { formatTimes } from '@/features/events/event-model';
import { rsvpLabels } from '@/features/guests/content';
import { DueTag } from '@/features/tasks/components/task-parts';
import { dashboardTasks, priorityLabels } from '@/features/tasks/content';
import { formatShortDate } from '@/features/tasks/task-model';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { EVENTS_PATH, TASKS_PATH } from '@/features/workspace/components/shell-parts';
import { SkeletonCard } from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { dashboardSummaries as copy } from '../content';

type ApiDashboard = components['schemas']['DashboardDto'];
type UpcomingEvent = ApiDashboard['upcomingEvents'][number];
type UpcomingTask = ApiDashboard['upcomingTasks'][number];

/**
 * The Phase 4 summaries below the Phase 3 cards (Stitch "P4 · O10", decisions 0019 #5 and
 * 0022), with the Phase 7 Tasks card after Upcoming events ("P7 · T6", decisions 0026 #20 and
 * 0027). The API returns at most five upcoming events and five upcoming tasks.
 */
export function DashboardSummaries({ wedding }: { wedding: ApiWedding }) {
  const router = useRouter();
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: ApiDashboard }
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/dashboard', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((result) => {
      if (!active) return;
      if (result.data) setState({ status: 'ready', data: result.data });
      else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, attempt, router]);

  if (state.status === 'loading') {
    return (
      <div className="mt-6 grid gap-6 md:grid-cols-2" aria-busy="true">
        <span className="sr-only" role="status">
          {copy.loading}
        </span>
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="mt-6 space-y-4">
        <Banner tone="error" icon="error">
          {copy.loadError}
        </Banner>
        <SecondaryButton
          icon="refresh"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        >
          {copy.retry}
        </SecondaryButton>
      </div>
    );
  }

  const { upcomingEvents, guestTotals, rsvpBreakdown, taskCounts, upcomingTasks, hasTasks } =
    state.data;
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <Card icon="festival" title={copy.upcomingTitle}>
        {upcomingEvents.length === 0 ? (
          <div className="py-4 text-center">
            <p className="font-medium text-navy">{copy.noUpcomingTitle}</p>
            <p className="mb-4 text-body-sm text-on-surface-variant">{copy.noUpcomingBody}</p>
            <Link
              href={`${EVENTS_PATH}/new`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-5 text-label-md text-on-primary hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              <Icon name="add" className="size-5" />
              {copy.addEvent}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-champagne"
                />
                <div className="min-w-0">
                  <p className="font-medium break-words text-navy">{event.name}</p>
                  <p className="text-body-sm break-words text-on-surface-variant">
                    {eventLine(event)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <TasksCard counts={taskCounts} upcoming={upcomingTasks} hasTasks={hasTasks} />

      <Card icon="group" title={copy.guestsTitle}>
        <p className="font-serif text-navy">
          <span className="text-[3rem] leading-none">
            {guestTotals.guests.toLocaleString('en-IN')}
          </span>{' '}
          <span className="text-title-lg font-normal text-on-surface-variant">
            {guestTotals.guests === 1 ? copy.guestsUnit.one : copy.guestsUnit.other}
          </span>
        </p>
        <p className="mt-2 text-body-sm text-on-surface-variant">{copy.guestsNote}</p>
      </Card>

      <Card icon="mark_email_read" title={copy.rsvpTitle}>
        <p className="mb-3 text-body-sm font-medium text-navy">{copy.rsvpSubtitle}</p>
        <dl className="grid grid-cols-2 gap-3">
          <Count
            icon="check_circle"
            label={rsvpLabels.ATTENDING}
            value={rsvpBreakdown.attending}
            tone="sage"
          />
          <Count
            icon="pending"
            label={rsvpLabels.PENDING}
            value={rsvpBreakdown.pending}
            tone="champagne"
          />
          <Count icon="help" label={rsvpLabels.MAYBE} value={rsvpBreakdown.maybe} tone="neutral" />
          <Count
            icon="cancel"
            label={rsvpLabels.DECLINED}
            value={rsvpBreakdown.declined}
            tone="rose"
          />
        </dl>
        <p className="mt-4 border-t border-hairline pt-3 text-body-sm text-on-surface-variant">
          {copy.rsvpNote}
        </p>
      </Card>

      <Card icon="person_pin_circle" title={copy.attendeesTitle}>
        {upcomingEvents.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">{copy.noAttendees}</p>
        ) : (
          <ul className="space-y-2">
            {upcomingEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2.5"
              >
                <span className="min-w-0 text-body-sm break-words text-navy">{event.name}</span>
                <span className="text-label-md text-navy">
                  {event.expectedAttendees.toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-hairline pt-3 text-body-sm text-on-surface-variant">
          {copy.attendeesNote}
        </p>
      </Card>
    </div>
  );
}

/**
 * The Tasks card (Stitch "P7 · T6"): four counts and up to five upcoming tasks. "No tasks
 * yet" only when the wedding has no tasks at all; when every task is cancelled the counts
 * show as zero with "View all tasks" (0026 #20).
 */
function TasksCard({
  counts,
  upcoming,
  hasTasks,
}: {
  counts: ApiDashboard['taskCounts'];
  upcoming: UpcomingTask[];
  hasTasks: boolean;
}) {
  return (
    <Card icon="checklist" title={dashboardTasks.title}>
      {!hasTasks ? (
        <div className="py-4 text-center">
          <p className="font-medium text-navy">{dashboardTasks.emptyTitle}</p>
          <p className="mb-4 text-body-sm text-on-surface-variant">{dashboardTasks.emptyBody}</p>
          <Link
            href={`${TASKS_PATH}/new`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-5 text-label-md text-on-primary hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <Icon name="add" className="size-5" />
            {dashboardTasks.add}
          </Link>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <Count
              icon="pending"
              label={dashboardTasks.pending}
              value={counts.pending}
              tone="champagne"
            />
            <Count
              icon="block"
              label={dashboardTasks.blocked}
              value={counts.blocked}
              tone="neutral"
            />
            <Count
              icon="check_circle"
              label={dashboardTasks.completed}
              value={counts.completed}
              tone="sage"
            />
            <Count
              icon="warning"
              label={dashboardTasks.overdue}
              value={counts.overdue}
              tone="rose"
            />
          </dl>
          <p className="mt-2 text-body-sm text-on-surface-variant">{dashboardTasks.overlapNote}</p>
          <h3 className="mt-4 mb-2 border-t border-hairline pt-3 text-label-md text-navy">
            {dashboardTasks.upcomingTitle}
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">{dashboardTasks.noUpcoming}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {upcoming.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`${TASKS_PATH}/${task.id}`}
                      className="rounded font-medium break-words text-navy hover:underline focus-visible:outline-2 focus-visible:outline-secondary"
                    >
                      {task.title}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
                      {formatShortDate(task.dueDate)}
                      <DueTag task={task} />
                    </p>
                  </div>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">
                    {priorityLabels[task.priority]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={TASKS_PATH}
            className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-lg text-label-md text-navy hover:underline focus-visible:outline-2 focus-visible:outline-secondary"
          >
            {dashboardTasks.viewAll}
            <Icon name="arrow_forward" className="size-4" />
          </Link>
        </>
      )}
    </Card>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 16 Feb 2027 · 16:00 – 20:00 · Garden Palace" (24-hour times). */
function eventLine(event: UpcomingEvent): string {
  const [year, month, day] = event.date.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const date = `${weekday} ${day} ${MONTHS[month - 1]} ${year}`;
  return [date, formatTimes(event.startTime, event.endTime), event.venueName]
    .filter(Boolean)
    .join(' · ');
}

function Card({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 border-b border-hairline pb-3 text-title-md text-navy">
        <Icon name={icon} className="size-5 text-secondary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Count({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName;
  label: string;
  value: number;
  tone: 'sage' | 'champagne' | 'neutral' | 'rose';
}) {
  const classes = {
    sage: 'bg-[#eef4f0] border-tertiary-fixed-dim',
    champagne: 'bg-[#faf5ee] border-secondary-fixed',
    neutral: 'bg-surface-container-low border-hairline',
    rose: 'bg-error-container/40 border-error/20',
  }[tone];
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${classes}`}
    >
      <dt className="flex items-center gap-1.5 text-body-sm text-navy">
        <Icon name={icon} className="size-4" />
        {label}
      </dt>
      <dd className="text-title-md text-navy">{value.toLocaleString('en-IN')}</dd>
    </div>
  );
}
