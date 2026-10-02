import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { legalLinks } from '@/components/layout/site-links';
import { Icon } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import { authFooter, authPanel } from '../content';

/**
 * Split layout shared by every auth screen (Stitch "Sign In (V1)" family): a navy photo
 * panel with the brand message on the left (top on narrow screens), the form on the right.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col bg-surface lg:flex-row">
      <section className="relative flex min-h-[340px] w-full flex-col justify-between overflow-hidden bg-primary-container sm:min-h-[380px] lg:min-h-screen lg:w-[45%]">
        <Image
          src={authPanel.image.src}
          alt={authPanel.image.alt}
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="scale-105 object-cover object-center lg:object-top"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/40 to-black/30" />
        <div className="pointer-events-none absolute inset-0 bg-radial from-transparent via-transparent to-primary-container/60" />

        <header className="relative z-10 flex items-center justify-between p-6 md:p-10">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md focus-visible:outline-2 focus-visible:outline-secondary-fixed"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-secondary-fixed text-label-sm text-on-secondary-fixed">
              M
            </span>
            <span className="text-label-md tracking-tight text-white">{authPanel.brand}</span>
          </Link>
        </header>

        <div className="relative z-10 mt-auto p-6 md:p-12">
          <div className="max-w-lg space-y-4">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-label-sm tracking-widest text-secondary-fixed uppercase">
                <span className="h-px w-6 bg-secondary-fixed" />
                {authPanel.eyebrow}
              </p>
              <p className="font-serif text-headline-lg-mobile leading-tight tracking-tight text-white md:text-headline-lg">
                {authPanel.title}
              </p>
              <p className="max-w-md pt-1 text-body-md leading-relaxed text-white/80">
                {authPanel.description}
              </p>
            </div>
            <div className="pt-3">
              <p className="inline-flex items-center gap-2.5 rounded-full border border-secondary/40 bg-black/40 px-4 py-2 text-label-sm text-surface backdrop-blur-md">
                <span className="font-bold text-secondary-fixed" aria-hidden="true">
                  ✦
                </span>
                {authPanel.badge}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-secondary/30 to-transparent lg:block" />
      </section>

      <section className="flex w-full flex-col justify-between bg-surface p-6 sm:p-10 md:p-14 lg:min-h-screen lg:w-[55%] lg:p-16">
        <div className="mx-auto my-auto w-full max-w-md py-8">
          <Link href="/" className="mb-6 inline-block" aria-label="MakeMyMarriage home">
            <Logo className="h-9 w-auto sm:h-10" />
          </Link>
          {children}
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-body-sm text-on-surface-variant/80">
            <Icon name="shield" className="size-4 text-secondary" />
            {authFooter.privacyNote}
          </p>
        </div>

        <footer className="flex w-full flex-col items-center justify-between gap-4 pt-8 text-body-sm text-outline sm:flex-row">
          <p>{authFooter.copyright}</p>
          <div className="flex items-center gap-5">
            {legalLinks.map((link, index) => (
              <span key={link.href} className="flex items-center gap-5">
                {index > 0 && <span className="size-1 rounded-full bg-outline-variant" />}
                <Link href={link.href} className="transition-colors hover:text-on-surface">
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
        </footer>
      </section>
    </main>
  );
}

/** Screen heading in the form column. */
export function AuthHeading({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon?: 'lock_reset';
}) {
  return (
    <div className="mb-8">
      {icon && (
        <div className="mb-3 inline-flex rounded-full bg-surface-container-high p-2.5 text-secondary">
          <Icon name={icon} className="size-6" />
        </div>
      )}
      <h1 className="font-serif text-headline-md tracking-tight text-primary">{title}</h1>
      <p className="mt-1.5 text-body-md leading-relaxed text-on-surface-variant">{subtitle}</p>
    </div>
  );
}
