import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { dashboard } from '../content';
import { BrowserFrame, Section, SectionHeading } from '../section';

const noteToneClasses = {
  sage: 'text-on-tertiary-container',
  champagne: 'text-secondary',
  muted: 'text-on-surface-variant',
  alert: 'text-error font-medium',
} as const;

const initialToneClasses = {
  champagne: 'bg-secondary-fixed text-on-secondary-fixed',
  gold: 'bg-secondary/20 text-secondary',
  navy: 'bg-primary-fixed text-on-primary-fixed',
} as const;

const actionClasses = 'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-label-sm shadow-sm';

export function DashboardPreview() {
  return (
    <Section tone="surface" bordered={false}>
      <SectionHeading
        eyebrow={dashboard.eyebrow}
        title={dashboard.title}
        description={dashboard.description}
        lead="md"
      />

      <BrowserFrame
        variant="app"
        address={dashboard.addressBar}
        label={<span className="text-xs text-on-surface-variant">{dashboard.frameLabel}</span>}
      >
        <div className="space-y-6 bg-surface p-4 sm:space-y-8 sm:p-6 md:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-outline-variant/20 pb-6 md:flex-row md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-headline-sm font-semibold text-on-surface">
                  {dashboard.weddingTitle}
                </h3>
                <Chip tone="champagne" className="text-xs">
                  {dashboard.coupleBadge}
                </Chip>
              </div>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                {dashboard.weddingSummary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {dashboard.actions.map((action) => (
                <span
                  key={action.label}
                  className={`${actionClasses} border border-outline-variant/40 bg-surface-container-lowest text-on-surface`}
                >
                  <Icon name={action.icon} className="size-4" />
                  {action.label}
                </span>
              ))}
              <span className={`${actionClasses} bg-primary-container text-on-primary`}>
                <Icon name="visibility" className="size-4" />
                {dashboard.previewAction}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {dashboard.metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-t-2 border-outline-variant/30 border-t-secondary bg-surface-container-lowest p-3 shadow-sm sm:p-4"
              >
                <p className="text-xs font-semibold text-on-surface-variant">{metric.label}</p>
                <p className="mt-1 font-serif text-xl font-bold text-on-surface tabular-nums sm:text-2xl">
                  {metric.value}
                  {'suffix' in metric && (
                    <span className="text-sm font-normal text-on-surface-variant">
                      {' '}
                      {metric.suffix}
                    </span>
                  )}
                </p>
                <p className={`mt-1 text-xs ${noteToneClasses[metric.noteTone]}`}>{metric.note}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm sm:p-6 lg:col-span-7">
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
                <h4 className="flex items-center gap-2 text-title-md text-on-surface">
                  <Icon name="festival" className="size-6 text-secondary" />
                  {dashboard.ceremoniesTitle}
                </h4>
                <span className="text-xs font-semibold whitespace-nowrap text-secondary">
                  {dashboard.ceremoniesLink}
                </span>
              </div>
              <ul className="space-y-3">
                {dashboard.upcomingCeremonies.map((ceremony) => (
                  <li
                    key={ceremony.name}
                    className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${initialToneClasses[ceremony.tone]}`}
                      >
                        {ceremony.initial}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-on-surface">{ceremony.name}</p>
                        <p className="text-xs text-on-surface-variant">{ceremony.when}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-on-surface-variant tabular-nums">
                      {ceremony.attending}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm sm:p-6 lg:col-span-5">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <h4 className="flex items-center gap-2 text-title-md text-on-surface">
                  <Icon name="payments" className="size-6 text-secondary" />
                  {dashboard.paymentsTitle}
                </h4>
                <span className="text-xs text-on-surface-variant">{dashboard.paymentsLabel}</span>
              </div>
              <ul className="space-y-3">
                {dashboard.payments.map((payment) => (
                  <li
                    key={payment.payee}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-on-surface">{payment.payee}</p>
                      <p className="text-[11px] text-on-surface-variant">{payment.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-on-surface tabular-nums">{payment.amount}</p>
                      <Chip tone={payment.tone} shape="tag" className="text-[10px]">
                        {payment.status}
                      </Chip>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-3 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-secondary" />
                  {dashboard.activity}
                </span>
                <span className="shrink-0 text-[11px]">{dashboard.activityTime}</span>
              </div>
            </div>
          </div>
        </div>
      </BrowserFrame>
    </Section>
  );
}
