import Link from 'next/link';
import { signUpHref } from '@/components/layout/site-links';
import { Icon } from '@/components/ui/icon';
import { weddingWebsite } from '../content';
import { BrowserFrame, Section, SectionHeading } from '../section';

export function WeddingWebsite() {
  const preview = weddingWebsite.preview;
  return (
    <Section id="wedding-website" tone="low">
      <SectionHeading
        eyebrow={weddingWebsite.eyebrow}
        title={weddingWebsite.title}
        description={weddingWebsite.description}
      >
        <div className="pt-2">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-secondary/40 bg-surface-container-lowest px-4 py-1.5 font-mono text-xs text-on-surface shadow-sm">
            <Icon name="link" className="size-3.5 shrink-0 text-secondary" />
            <span className="truncate">{weddingWebsite.address}</span>
          </span>
        </div>
      </SectionHeading>

      <BrowserFrame
        variant="site"
        address={weddingWebsite.address}
        label={
          <span className="text-[11px] font-semibold text-secondary">
            {weddingWebsite.previewLabel}
          </span>
        }
      >
        <div className="space-y-8 bg-ivory p-6 text-center sm:p-8 md:p-12">
          <div className="mx-auto max-w-xl space-y-2">
            <p className="text-label-sm tracking-widest text-secondary uppercase">
              {preview.eyebrow}
            </p>
            <p className="font-serif text-headline-lg-mobile text-on-surface sm:text-headline-lg md:text-display-hero">
              {preview.couple}
            </p>
            <p className="text-body-md text-on-surface-variant italic">{preview.invitation}</p>
            <p className="pt-1 text-title-md text-on-surface">{preview.dates}</p>
          </div>

          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-outline-variant/30 py-3 text-xs font-semibold">
            {preview.tabs.map((tab, index) => (
              <span
                key={tab}
                className={
                  index === 0
                    ? 'border-b border-secondary pb-0.5 font-bold text-secondary'
                    : 'flex items-center gap-1 text-on-surface-variant'
                }
              >
                {tab === preview.liveTab && <span className="size-1.5 rounded-full bg-error" />}
                {tab}
              </span>
            ))}
          </div>

          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 text-left sm:gap-6 md:grid-cols-2">
            {preview.cards.map((card) => (
              <div
                key={card.eyebrow}
                className="space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5"
              >
                <p className="text-[10px] font-bold text-secondary uppercase">{card.eyebrow}</p>
                <p className="text-title-md text-on-surface">{card.title}</p>
                <p className="text-xs text-on-surface-variant">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <Link
              href={signUpHref}
              className="inline-flex items-center gap-2 rounded-full bg-primary-container px-6 py-2.5 text-xs font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              {weddingWebsite.cta}
              <Icon name="arrow_forward" className="size-3.5" />
            </Link>
          </div>
        </div>
      </BrowserFrame>
    </Section>
  );
}
