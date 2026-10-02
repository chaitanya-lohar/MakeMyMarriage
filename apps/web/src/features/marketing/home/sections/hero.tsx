import Image from 'next/image';
import { signUpHref } from '@/components/layout/site-links';
import { ButtonLink } from '@/components/ui/button-link';
import { Icon } from '@/components/ui/icon';
import { hero } from '../content';

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-outline-variant/20 pt-10 pb-16 sm:pt-12 sm:pb-20 md:py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 md:px-12 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-7 sm:space-y-8 lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-surface-container px-3.5 py-1.5">
            <span className="size-2 rounded-full bg-secondary" />
            <span className="text-label-sm tracking-wider text-secondary uppercase">
              {hero.eyebrow}
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="font-serif text-display-hero-mobile leading-tight tracking-tight text-on-surface sm:text-headline-lg md:text-display-hero">
              {hero.titleLead}
              <br />
              <span className="font-normal text-secondary italic">{hero.titleAccent}</span>
            </h1>
            <p className="max-w-xl text-body-md text-on-surface-variant sm:text-body-lg">
              {hero.description}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
            <ButtonLink
              href={signUpHref}
              size="lg"
              trailingIcon="arrow_forward"
              className="shadow-md"
            >
              {hero.primaryCta}
            </ButtonLink>
            <ButtonLink
              href="#how-it-works"
              variant="secondary"
              size="lg"
              leadingIcon="play_circle"
            >
              {hero.secondaryCta}
            </ButtonLink>
          </div>

          <div className="flex items-center gap-2 border-t border-outline-variant/30 pt-6">
            <Icon name="check_circle" className="size-4 text-secondary" />
            <p className="text-body-sm text-on-surface-variant">{hero.note}</p>
          </div>
        </div>

        <div className="relative flex justify-center lg:col-span-6">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-secondary/30 bg-surface-container-lowest p-2 shadow-gold-glow shadow-xl lg:max-w-none">
            <Image
              src={hero.image.src}
              alt={hero.image.alt}
              width={hero.image.width}
              height={hero.image.height}
              priority
              sizes="(min-width: 1024px) 45vw, (min-width: 640px) 32rem, 100vw"
              className="h-[340px] w-full rounded-xl object-cover object-center sm:h-[440px] lg:h-[520px]"
            />
            <div className="pointer-events-none absolute inset-2 rounded-xl bg-gradient-to-t from-primary-container/20 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
