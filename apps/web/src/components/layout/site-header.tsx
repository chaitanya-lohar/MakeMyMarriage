import Link from 'next/link';
import { ButtonLink } from '../ui/button-link';
import { LogoLink } from '../ui/logo';
import { MobileNav } from './mobile-nav';
import { headerLinks, signInHref, signUpHref } from './site-links';

/** Sticky, translucent public-site header. Below `lg` the links move into MobileNav. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant/30 bg-surface/85 text-primary shadow-sm backdrop-blur-md">
      <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 md:px-12">
        <LogoLink className="h-9 w-auto sm:h-10" />

        <nav aria-label="Main" className="hidden items-center space-x-8 whitespace-nowrap lg:flex">
          {headerLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                index === 0
                  ? 'border-b-2 border-secondary pb-1 text-title-md text-primary transition-colors duration-200 hover:text-secondary'
                  : 'text-label-md text-on-surface-variant transition-colors duration-200 hover:text-secondary'
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href={signInHref}
            className="hidden rounded-lg px-4 py-2 text-label-md whitespace-nowrap text-on-surface transition-colors duration-200 hover:text-secondary lg:inline-block"
          >
            Sign In
          </Link>
          {/* Wrapped so `hidden` is not overridden by the button's own display class. */}
          <div className="hidden sm:block">
            <ButtonLink href={signUpHref} trailingIcon="arrow_forward">
              Create Your Wedding
            </ButtonLink>
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
