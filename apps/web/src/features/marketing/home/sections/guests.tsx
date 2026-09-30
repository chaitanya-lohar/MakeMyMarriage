import { Chip, type ChipTone } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { guests, type GuestRow, type RsvpStatus } from '../content';
import { Section, SectionHeading } from '../section';

const rsvpTones: Record<RsvpStatus, ChipTone> = {
  Attending: 'sage',
  Pending: 'champagne',
  Declined: 'muted',
  Maybe: 'neutral',
};

function RsvpChip({ row }: { row: GuestRow }) {
  return (
    <Chip tone={rsvpTones[row.rsvp]} className="text-[11px]">
      {row.rsvpScope ? `${row.rsvp} · ${row.rsvpScope}` : row.rsvp}
    </Chip>
  );
}

function InvitationPhone() {
  const card = guests.invitation;
  return (
    <div className="relative w-full max-w-[320px] rounded-[36px] border-4 border-surface-container-highest bg-primary-container p-3 shadow-2xl">
      <div className="mx-auto mb-2 h-4 w-24 rounded-full bg-primary-container" />
      <div className="space-y-4 overflow-hidden rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 text-center">
        <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
          {card.eyebrow}
        </p>
        <p className="font-serif text-headline-sm text-on-surface">{card.couple}</p>
        <p className="font-mono text-xs text-on-surface-variant">{card.dates}</p>
        <div className="mx-auto my-2 h-px w-3/4 bg-outline-variant/30" />
        <div className="space-y-1 rounded-lg bg-surface-container-low p-3 text-left">
          <p className="text-[10px] font-semibold text-secondary uppercase">{card.forLabel}</p>
          <p className="text-xs font-bold text-on-surface">{card.guest}</p>
          <p className="text-[11px] text-on-surface-variant">{card.invitedTo}</p>
        </div>
        <div className="space-y-2 rounded-lg border border-secondary/30 bg-surface-container-lowest p-3">
          <p className="text-xs font-medium text-on-surface">{card.question}</p>
          <div className="flex gap-2">
            <span className="w-1/2 rounded bg-primary-container py-1.5 text-[11px] font-semibold text-white">
              {card.accept}
            </span>
            <span className="w-1/2 rounded bg-surface-container py-1.5 text-[11px] text-on-surface-variant">
              {card.decline}
            </span>
          </div>
        </div>
        <p className="flex items-center justify-center gap-1 pt-1 text-[11px] text-secondary">
          <Icon name="map" className="size-3.5" />
          <span className="underline">{card.venueLink}</span>
        </p>
      </div>
    </div>
  );
}

function GuestDirectory() {
  return (
    <div className="space-y-5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-md sm:space-y-6 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h3 className="text-title-lg text-on-surface">{guests.directoryTitle}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface">
            <Icon name="link" className="size-3.5" />
            {guests.copyLink}
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary">
            <Icon name="send" className="size-3.5" />
            {guests.send}
          </span>
        </div>
      </div>

      {/* Narrow screens: one card per guest instead of a sideways-scrolling table. */}
      <ul className="divide-y divide-outline-variant/20 border-y border-outline-variant/30 sm:hidden">
        {guests.rows.map((row) => (
          <li key={row.name} className="space-y-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-on-surface">{row.name}</p>
                <p className="text-[11px] text-on-surface-variant">{row.relation}</p>
              </div>
              <RsvpChip row={row} />
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {row.attendees} · Invitation {row.invitation.toLowerCase()}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <table className="w-full text-left text-xs">
          <thead className="border-y border-outline-variant/30 bg-surface-container-low font-semibold text-on-surface-variant">
            <tr>
              {guests.columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2.5">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {guests.rows.map((row) => (
              <tr key={row.name}>
                <td className="px-3 py-3">
                  <p className="font-semibold text-on-surface">{row.name}</p>
                  <p className="text-[11px] text-on-surface-variant">{row.relation}</p>
                </td>
                <td className="px-3 py-3">
                  <RsvpChip row={row} />
                </td>
                <td className="px-3 py-3 tabular-nums">{row.attendees}</td>
                <td className="px-3 py-3 font-medium text-on-surface-variant">{row.invitation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col justify-between gap-1 border-t border-outline-variant/20 pt-2 text-xs text-on-surface-variant sm:flex-row sm:items-center">
        <span>{guests.footerCount}</span>
        <span>{guests.footerChannels}</span>
      </div>
    </div>
  );
}

export function Guests() {
  return (
    <Section tone="surface" bordered={false}>
      <SectionHeading
        eyebrow={guests.eyebrow}
        title={guests.title}
        description={guests.description}
      />
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex justify-center lg:col-span-5">
          <InvitationPhone />
        </div>
        <div className="lg:col-span-7">
          <GuestDirectory />
        </div>
      </div>
    </Section>
  );
}
