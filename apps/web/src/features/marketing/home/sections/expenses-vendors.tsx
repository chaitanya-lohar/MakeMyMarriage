import type { ReactNode } from 'react';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { expensesAndVendors } from '../content';
import { Section, SectionHeading } from '../section';

const totalToneClasses = {
  default: 'text-on-surface',
  gold: 'text-secondary',
  sage: 'text-on-tertiary-container',
} as const;

const cardClasses =
  'space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-md sm:p-8';

function CardHeader({
  title,
  summary,
  aside,
}: {
  title: string;
  summary: string;
  aside: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
      <div>
        <h3 className="font-serif text-headline-sm text-on-surface">{title}</h3>
        <p className="mt-0.5 text-xs text-on-surface-variant">{summary}</p>
      </div>
      {aside}
    </div>
  );
}

export function ExpensesVendors() {
  const { vendors, expenses } = expensesAndVendors;
  return (
    <Section tone="surface">
      <SectionHeading
        eyebrow={expensesAndVendors.eyebrow}
        title={expensesAndVendors.title}
        description={expensesAndVendors.description}
      />
      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
        <div className={cardClasses}>
          <CardHeader
            title={vendors.title}
            summary={vendors.summary}
            aside={
              <span className="flex shrink-0 items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface">
                <Icon name="add" className="size-3.5" />
                {vendors.add}
              </span>
            }
          />
          <ul className="space-y-3 sm:space-y-4">
            {vendors.rows.map((vendor) => (
              <li
                key={vendor.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-on-surface">{vendor.name}</span>
                    <Chip tone="muted" shape="tag" className="text-[10px] font-normal">
                      {vendor.category}
                    </Chip>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">{vendor.detail}</p>
                </div>
                <Chip tone={vendor.tone} shape="tag" className="px-2.5 py-1 text-xs">
                  {vendor.status}
                </Chip>
              </li>
            ))}
          </ul>
        </div>

        <div className={cardClasses}>
          <CardHeader
            title={expenses.title}
            summary={expenses.summary}
            aside={
              <Chip tone="sage" className="shrink-0 py-1 text-xs">
                {expenses.badge}
              </Chip>
            }
          />
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-container-low p-3 text-center sm:gap-3 sm:p-4">
            {expenses.totals.map((total, index) => (
              <div
                key={total.label}
                className={index === 1 ? 'border-x border-outline-variant/30' : ''}
              >
                <p className="text-[11px] text-on-surface-variant">{total.label}</p>
                <p
                  className={`mt-0.5 text-sm font-bold tabular-nums sm:text-base ${totalToneClasses[total.tone]}`}
                >
                  {total.value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex flex-col justify-between gap-1 text-xs font-semibold text-on-surface sm:flex-row">
              <span>{expenses.breakdownTitle}</span>
              <span className="hidden sm:inline">
                {expenses.categories.map((category) => category.label).join(' · ')}
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container">
              {expenses.categories.map((category) => (
                <div
                  key={category.label}
                  className={`h-full ${category.colour}`}
                  style={{ width: `${category.share}%` }}
                  title={category.label}
                />
              ))}
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-on-surface-variant">
              {expenses.categories.map((category) => (
                <li key={category.label} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${category.colour}`} />
                  {category.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1 rounded-xl border border-secondary/30 bg-surface-container-low p-3.5 text-xs">
            <p className="flex items-center justify-between font-semibold text-on-surface">
              <span>{expenses.latestPaymentTitle}</span>
              <span className="font-bold text-secondary">{expenses.latestPaymentDate}</span>
            </p>
            <p className="text-[11px] text-on-surface-variant">{expenses.latestPayment}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
