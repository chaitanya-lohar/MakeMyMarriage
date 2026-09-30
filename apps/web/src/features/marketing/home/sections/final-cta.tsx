import { signUpHref } from '@/components/layout/site-links';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { finalCta } from '../content';

export function FinalCta() {
  return (
    <section
      id="create"
      className="relative overflow-hidden bg-primary-container py-20 text-on-primary sm:py-24"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-secondary/20 via-transparent to-transparent" />
      <div className="relative z-10 mx-auto max-w-5xl space-y-8 px-4 text-center sm:px-6 md:px-12">
        <p className="inline-flex items-center rounded-full border border-secondary-fixed-dim/30 bg-surface-container-lowest/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-secondary-fixed uppercase backdrop-blur-sm">
          {finalCta.badge}
        </p>
        <h2 className="font-serif text-headline-lg-mobile tracking-tight text-white sm:text-headline-lg md:text-display-hero">
          {finalCta.titleLines[0]}
          <br />
          {finalCta.titleLines[1]}
        </h2>
        <p className="mx-auto max-w-2xl text-body-md text-outline-variant sm:text-body-lg">
          {finalCta.description}
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 pt-4 sm:flex-row sm:items-center sm:gap-4">
          <ButtonLink href={signUpHref} variant="champagne" size="lg" trailingIcon="arrow_forward">
            {finalCta.primaryCta}
          </ButtonLink>
          <ButtonLink href="#how-it-works" variant="on-dark" size="lg">
            {finalCta.secondaryCta}
          </ButtonLink>
        </div>
        <ul className="flex flex-col items-center justify-center gap-3 pt-6 text-xs text-outline-variant sm:flex-row sm:flex-wrap sm:gap-8 sm:pt-8">
          {finalCta.highlights.map((highlight) => (
            <li key={highlight} className="flex items-center gap-1.5">
              <Icon name="check_circle" className="size-4 text-secondary-fixed" />
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
